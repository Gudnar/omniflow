import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundError, ValidationError } from '@omniflow/utils';
import { EventsService } from '../events/events.service';
import { TenantContextService } from '../tenant-context/tenant-context.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ConfirmationImagesService } from '../confirmation-images/confirmation-images.service';
import { buildPreparationNotice } from './orders.service';
import { AddCartItemDto, UpdateCartItemDto, CheckoutDto } from './dto/cart.dto';

// Exported so any other service that needs a fully-hydrated cart (product/
// variant names, not just raw CartItem rows) reuses the exact same shape —
// see CommerceSessionsService.findOne, whose own `items: true` include used
// to omit these, crashing the storefront's cart drawer on `item.product.name`.
export const CART_INCLUDE = {
  items: {
    include: {
      product: {
        select: { id: true, name: true, requiresPreparation: true, preparationReason: true, preparationMinutes: true },
      },
      variant: { select: { id: true, name: true, sku: true } },
    },
  },
};

export function serializeCart(cart: any) {
  return {
    ...cart,
    subtotal: Number(cart.subtotal),
    discount: Number(cart.discount),
    shipping: Number(cart.shipping),
    tax: Number(cart.tax),
    total: Number(cart.total),
    items: cart.items?.map((item: any) => ({
      ...item,
      unitPrice: Number(item.unitPrice),
      discount: Number(item.discount),
      subtotal: Number(item.subtotal),
    })),
  };
}

function serializeOrder(order: any) {
  return {
    ...order,
    subtotal: Number(order.subtotal),
    discount: Number(order.discount),
    shipping: Number(order.shipping),
    tax: Number(order.tax),
    total: Number(order.total),
    items: order.items?.map((item: any) => ({
      ...item,
      unitPrice: Number(item.unitPrice),
      discount: Number(item.discount),
      subtotal: Number(item.subtotal),
    })),
  };
}

@Injectable()
export class CartsService {
  constructor(
    private prisma: PrismaService,
    private eventsService: EventsService,
    private tenantContext: TenantContextService,
    private notificationsService: NotificationsService,
    private confirmationImagesService: ConfirmationImagesService,
  ) {}

  async findOne(id: string) {
    const cart = await this.prisma.client.cart.findUnique({ where: { id }, include: CART_INCLUDE });
    if (!cart) throw new NotFoundError('Cart');
    return serializeCart(cart);
  }

  private async recalculateTotals(cartId: string) {
    const items = await this.prisma.client.cartItem.findMany({ where: { cartId } });
    const subtotal = items.reduce((sum: number, i: any) => sum + Number(i.subtotal), 0);
    const cart = await this.prisma.client.cart.findUnique({ where: { id: cartId } });
    const total = subtotal - Number(cart.discount) + Number(cart.shipping) + Number(cart.tax);
    await this.prisma.client.cart.update({ where: { id: cartId }, data: { subtotal, total } });
  }

  async updateBranch(id: string, branchId: string) {
    await this.findOne(id);
    await this.prisma.client.cart.update({ where: { id }, data: { branchId } });
    return this.validate(id);
  }

  async addItem(id: string, dto: AddCartItemDto) {
    const cart = await this.findOne(id);
    if (cart.status !== 'ACTIVE') throw new ValidationError('Only an ACTIVE cart can be modified');
    if (!cart.branchId) throw new ValidationError('Cart must have a branch selected before adding items');

    const branchProduct = await this.prisma.client.branchProduct.findUnique({
      where: { branchId_variantId: { branchId: cart.branchId, variantId: dto.variantId } },
    });
    if (!branchProduct || branchProduct.status !== 'AVAILABLE') {
      throw new ValidationError('This product is not available at the selected branch');
    }

    const existing = await this.prisma.client.cartItem.findUnique({
      where: { cartId_variantId: { cartId: id, variantId: dto.variantId } },
    });

    const unitPrice = Number(branchProduct.price);
    if (existing) {
      const quantity = existing.quantity + dto.quantity;
      await this.prisma.client.cartItem.update({
        where: { id: existing.id },
        data: { quantity, unitPrice, subtotal: unitPrice * quantity - Number(existing.discount) },
      });
    } else {
      await this.prisma.client.cartItem.create({
        data: {
          cartId: id,
          productId: branchProduct.productId,
          variantId: dto.variantId,
          quantity: dto.quantity,
          unitPrice,
          subtotal: unitPrice * dto.quantity,
        },
      });
    }

    await this.recalculateTotals(id);
    return this.findOne(id);
  }

  async updateItem(id: string, itemId: string, dto: UpdateCartItemDto) {
    const item = await this.prisma.client.cartItem.findFirst({ where: { id: itemId, cartId: id } });
    if (!item) throw new NotFoundError('CartItem');

    await this.prisma.client.cartItem.update({
      where: { id: itemId },
      data: { quantity: dto.quantity, subtotal: Number(item.unitPrice) * dto.quantity - Number(item.discount) },
    });

    await this.recalculateTotals(id);
    return this.findOne(id);
  }

  async removeItem(id: string, itemId: string) {
    const item = await this.prisma.client.cartItem.findFirst({ where: { id: itemId, cartId: id } });
    if (!item) throw new NotFoundError('CartItem');

    await this.prisma.client.cartItem.delete({ where: { id: itemId } });
    await this.recalculateTotals(id);
    return this.findOne(id);
  }

  // Dry-run: recomputes every item's price/availability against current
  // BranchProduct state, updating stale prices in place, and reports issues.
  // Does not change cart.status.
  private async checkItems(cart: any) {
    const issues: { itemId: string; variantId: string; type: string; message: string }[] = [];

    for (const item of cart.items) {
      if (!cart.branchId) {
        issues.push({ itemId: item.id, variantId: item.variantId, type: 'NO_BRANCH', message: 'Cart has no branch selected' });
        continue;
      }

      const branchProduct = await this.prisma.client.branchProduct.findUnique({
        where: { branchId_variantId: { branchId: cart.branchId, variantId: item.variantId } },
      });

      if (!branchProduct || branchProduct.status !== 'AVAILABLE') {
        issues.push({ itemId: item.id, variantId: item.variantId, type: 'UNAVAILABLE', message: 'Product is not available at this branch' });
        continue;
      }

      const currentPrice = Number(branchProduct.price);
      if (currentPrice !== item.unitPrice) {
        const subtotal = currentPrice * item.quantity - item.discount;
        await this.prisma.client.cartItem.update({
          where: { id: item.id },
          data: { unitPrice: currentPrice, subtotal },
        });
        issues.push({ itemId: item.id, variantId: item.variantId, type: 'PRICE_CHANGED', message: `Price updated from ${item.unitPrice} to ${currentPrice}` });
      }

      const availableToSell = branchProduct.stock - branchProduct.reservedStock;
      if (availableToSell < item.quantity) {
        issues.push({
          itemId: item.id,
          variantId: item.variantId,
          type: 'INSUFFICIENT_STOCK',
          message: `Only ${availableToSell} units available, ${item.quantity} requested`,
        });
      }
    }

    return issues;
  }

  async validate(id: string) {
    const cart = await this.findOne(id);
    const issues = await this.checkItems(cart);
    // checkItems may have corrected stale per-item prices — recompute
    // cart-level totals from the now-current items before returning.
    await this.recalculateTotals(id);
    return { cart: await this.findOne(id), issues };
  }

  async checkout(id: string, dto: CheckoutDto) {
    const cart = await this.findOne(id);
    if (cart.status !== 'ACTIVE') throw new ValidationError('Only an ACTIVE cart can be checked out');
    if (!cart.items.length) throw new ValidationError('Cannot checkout an empty cart');
    if (dto.fulfillmentType !== 'PICKUP' && !dto.addressId) {
      throw new ValidationError('addressId is required for LOCAL_DELIVERY/SHIPPING fulfillment');
    }

    const issues = await this.checkItems(cart);
    if (issues.length) {
      throw new ValidationError('Cart failed validation and cannot be checked out', { issues });
    }

    // checkItems may have corrected stale per-item prices — recompute
    // cart-level totals before snapshotting them onto the new Order.
    await this.recalculateTotals(id);
    const freshCart = await this.findOne(id);

    const tenantId = this.tenantContext.getTenantId();
    const tenant = tenantId
      ? await this.prisma.client.tenant.findUnique({
          where: { id: tenantId },
          select: {
            name: true,
            orderApprovalMode: true,
            notifyOnOrderPendingApproval: true,
            sendOrderQrCode: true,
            sendOrderReceiptImage: true,
          },
        })
      : null;
    const requiresManualApproval = tenant?.orderApprovalMode === 'MANUAL';

    // Snapshot whatever GPS location the storefront captured on this
    // session — CommerceSession.metadata.location — onto the order itself.
    // Previously this was captured then silently discarded: the order had
    // no record of it at all once checkout ran.
    let customerLocation: any = null;
    let conversationId: string | null = null;
    if (freshCart.commerceSessionId) {
      const session = await this.prisma.client.commerceSession.findUnique({
        where: { id: freshCart.commerceSessionId },
        select: { metadata: true, conversationId: true },
      });
      customerLocation = (session?.metadata as any)?.location ?? null;
      conversationId = session?.conversationId ?? null;
    }

    const order = await this.prisma.client.$transaction(async (tx: any) => {
      for (const item of freshCart.items) {
        const branchProduct = await tx.branchProduct.findUnique({
          where: { branchId_variantId: { branchId: freshCart.branchId, variantId: item.variantId } },
        });
        await tx.branchProduct.update({
          where: { id: branchProduct.id },
          data: { reservedStock: branchProduct.reservedStock + item.quantity },
        });
      }

      const orderNumber = `ORD-${Date.now().toString(36).toUpperCase()}`;

      const created = await tx.order.create({
        data: {
          contactId: freshCart.contactId,
          cartId: freshCart.id,
          branchId: freshCart.branchId,
          addressId: dto.addressId,
          orderNumber,
          fulfillmentType: dto.fulfillmentType,
          status: requiresManualApproval ? 'PENDING' : 'CONFIRMED',
          confirmedAt: requiresManualApproval ? null : new Date(),
          customerLocation,
          subtotal: freshCart.subtotal,
          discount: freshCart.discount,
          shipping: freshCart.shipping,
          tax: freshCart.tax,
          total: freshCart.total,
          currency: freshCart.currency,
        },
      });

      // Phase 18: Manual fulfillment — the operational record kept in sync
      // with the order's own status (see OrdersService.transition), not a
      // second state machine.
      await tx.fulfillment.create({
        data: {
          orderId: created.id,
          type: dto.fulfillmentType,
          branchId: freshCart.branchId,
          addressId: dto.addressId,
          status: 'PENDING',
        },
      });

      await tx.orderItem.createMany({
        data: freshCart.items.map((item: any) => ({
          orderId: created.id,
          productId: item.productId,
          variantId: item.variantId,
          productNameSnapshot: item.product.name,
          skuSnapshot: item.variant.sku,
          requiresPreparationSnapshot: !!item.product.requiresPreparation,
          preparationReasonSnapshot: item.product.requiresPreparation ? item.product.preparationReason : null,
          preparationMinutesSnapshot: item.product.requiresPreparation ? item.product.preparationMinutes : null,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          discount: item.discount,
          subtotal: item.subtotal,
        })),
      });

      await tx.cart.update({ where: { id: freshCart.id }, data: { status: 'CHECKED_OUT' } });

      return tx.order.findUnique({ where: { id: created.id }, include: { items: true, fulfillment: true } });
    });

    // productIds/productNames — lets a Flow's CONDITION node target "this
    // order contains product X" (operator: 'contains' on an array already
    // works via evaluateCondition, no engine change needed) and keeps the
    // Flow builder's {{event.payload...}} interpolation useful for
    // product-level follow-up messages, not just order-level ones.
    const productIds = order.items.map((item: any) => item.productId);
    const productNames = order.items.map((item: any) => item.productNameSnapshot);

    await this.eventsService.emit(
      'order.created',
      { orderId: order.id, orderNumber: order.orderNumber, total: Number(order.total), productIds, productNames },
      order.contactId,
    );

    if (tenantId && conversationId && (tenant?.sendOrderQrCode || tenant?.sendOrderReceiptImage)) {
      const preparationNotice = buildPreparationNotice(order.items, order.fulfillmentType);
      const flaggedForPrep = order.items.filter((i: any) => i.requiresPreparationSnapshot);
      const maxPrepMinutes = Math.max(0, ...flaggedForPrep.map((i: any) => i.preparationMinutesSnapshot ?? 0));

      await this.confirmationImagesService.send({
        tenantId,
        conversationId,
        sendQrCode: !!tenant?.sendOrderQrCode,
        sendReceiptImage: !!tenant?.sendOrderReceiptImage,
        qrText: [
          'Pedido confirmado',
          `N°: ${order.orderNumber}`,
          `Total: ${order.currency} ${Number(order.total).toFixed(2)}`,
          ...(preparationNotice ? [preparationNotice] : []),
        ].join('\n'),
        receipt: {
          businessName: tenant?.name ?? '',
          title: `Pedido ${order.orderNumber}`,
          subtitle: new Date(order.createdAt).toLocaleString('es-BO', { dateStyle: 'medium', timeStyle: 'short' }),
          lines: [
            ...order.items.map((item: any) => ({
              label: `${item.productNameSnapshot} x${item.quantity}`,
              value: `${order.currency} ${Number(item.subtotal).toFixed(2)}`,
            })),
            ...(preparationNotice
              ? [{ label: '⏱️ Preparación necesaria', value: maxPrepMinutes > 0 ? `~${maxPrepMinutes} min` : 'Sí' }]
              : []),
          ],
          totalLabel: 'Total',
          totalValue: `${order.currency} ${Number(order.total).toFixed(2)}`,
          footer: '¡Gracias por tu compra!',
        },
      });
    }

    if (requiresManualApproval) {
      await this.eventsService.emit(
        'order.pending_approval',
        { orderId: order.id, orderNumber: order.orderNumber, total: Number(order.total), productIds, productNames },
        order.contactId,
      );
      if (tenant?.notifyOnOrderPendingApproval) {
        await this.notificationsService.create({
          type: 'order.pending_approval',
          title: `Nuevo pedido pendiente de aprobación: ${order.orderNumber}`,
          body: `${order.currency} ${Number(order.total).toFixed(2)}`,
          link: '/dashboard/orders',
        });
      }
    } else if (tenant?.notifyOnOrderConfirmed) {
      await this.notificationsService.create({
        type: 'order.confirmed',
        title: `Nuevo pedido confirmado: ${order.orderNumber}`,
        body: `${order.currency} ${Number(order.total).toFixed(2)}`,
        link: '/dashboard/orders',
      });
    }

    return serializeOrder(order);
  }
}
