import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundError, ValidationError } from '@omniflow/utils';
import { EventsService } from '../events/events.service';
import {
  ListOrdersQueryDto,
  UpdateOrderStatusDto,
  CancelOrderDto,
  UpdateOrderFulfillmentDto,
  UpdateOrderTrackingCodeDto,
} from './dto/order.dto';

// Which of order.confirmed/order.cancelled/order.delivered (EVENTS_AND_WORKFLOWS.md's
// catalog) a transition into a given status corresponds to. order.paid/
// order.ready aren't wired — no payment module (Phase 22) or fulfillment
// status distinct from PREPARING/READY exists yet to justify them.
const STATUS_EVENT: Record<string, string> = {
  CONFIRMED: 'order.confirmed',
  CANCELLED: 'order.cancelled',
  DELIVERED: 'order.delivered',
};

const ORDER_INCLUDE = {
  items: true,
  address: true,
  contact: { select: { id: true, name: true } },
  branch: { select: { id: true, name: true } },
  fulfillment: true,
};

// Phase 18: Manual fulfillment — Fulfillment.status is kept in sync with the
// order's own status, not driven independently (see DOMAIN_RULES.md: "Delivery
// manual es una herramienta operativa, no un motor logístico autónomo").
// PREPARING/CONFIRMED have no mapping — the fulfillment stays PENDING.
const FULFILLMENT_STATUS_BY_ORDER_STATUS: Record<string, string> = {
  READY: 'READY',
  DELIVERED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
};

// Transitioning to DELIVERED closes the loop deferred in Phases 9-10: it
// performs the actual BranchProduct.stock deduction (the reservation made at
// checkout only ever touched reservedStock). Cancelling releases the
// reservation without ever having touched stock.
const TRANSITIONS: Record<string, string[]> = {
  PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['PREPARING', 'CANCELLED'],
  PREPARING: ['READY', 'CANCELLED'],
  READY: ['DELIVERED', 'CANCELLED'],
  DELIVERED: [],
  CANCELLED: [],
};

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
export class OrdersService {
  constructor(
    private prisma: PrismaService,
    private eventsService: EventsService,
  ) {}

  async list(query: ListOrdersQueryDto) {
    const orders = await this.prisma.client.order.findMany({
      where: {
        ...(query.status && { status: query.status }),
        ...(query.branchId && { branchId: query.branchId }),
      },
      include: ORDER_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
    return orders.map(serializeOrder);
  }

  async findOne(id: string) {
    const order = await this.prisma.client.order.findUnique({ where: { id }, include: ORDER_INCLUDE });
    if (!order) throw new NotFoundError('Order');
    return serializeOrder(order);
  }

  async listForContact(contactId: string) {
    const orders = await this.prisma.client.order.findMany({
      where: { contactId },
      include: ORDER_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
    return orders.map(serializeOrder);
  }

  async listStatusHistory(orderId: string) {
    await this.findOne(orderId);
    return this.prisma.client.orderStatusHistory.findMany({
      where: { orderId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async confirm(id: string, actorUserId: string, note?: string) {
    const order = await this.findOne(id);
    if (order.status !== 'PENDING') {
      throw new ValidationError('Only a PENDING order can be confirmed');
    }
    return this.transition(id, 'CONFIRMED', actorUserId, note);
  }

  async cancel(id: string, actorUserId: string, dto: CancelOrderDto) {
    return this.transition(id, 'CANCELLED', actorUserId, dto.note);
  }

  async setStatus(id: string, actorUserId: string, dto: UpdateOrderStatusDto) {
    return this.transition(id, dto.status, actorUserId, dto.note, dto.receivedByName);
  }

  async updateFulfillment(id: string, dto: UpdateOrderFulfillmentDto) {
    const order = await this.findOne(id);
    if (order.status === 'DELIVERED' || order.status === 'CANCELLED') {
      throw new ValidationError('Cannot change fulfillment on a completed/cancelled order');
    }
    if (dto.fulfillmentType !== 'PICKUP' && !dto.addressId) {
      throw new ValidationError('addressId is required for LOCAL_DELIVERY/SHIPPING fulfillment');
    }

    await this.prisma.client.order.update({
      where: { id },
      data: { fulfillmentType: dto.fulfillmentType, addressId: dto.addressId },
    });
    // updateMany (not update) — safe no-op for orders that predate this
    // phase and never got a Fulfillment row via checkout().
    await this.prisma.client.fulfillment.updateMany({
      where: { orderId: id },
      data: {
        type: dto.fulfillmentType,
        addressId: dto.addressId,
        ...(dto.scheduledAt !== undefined && { scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : null }),
      },
    });
    return this.findOne(id);
  }

  // Free-text "comanda"/guía de envío — purely operational labeling, no
  // validation of format since an in-house ticket and a courier's own
  // waybill number look nothing alike.
  async updateTrackingCode(id: string, dto: UpdateOrderTrackingCodeDto) {
    await this.findOne(id);
    await this.prisma.client.order.update({ where: { id }, data: { trackingCode: dto.trackingCode } });
    return this.findOne(id);
  }

  private async transition(
    id: string,
    toStatus: string,
    actorUserId: string | undefined,
    note: string | undefined,
    receivedByName?: string,
  ) {
    const order = await this.findOne(id);
    const allowed = TRANSITIONS[order.status] ?? [];
    if (!allowed.includes(toStatus)) {
      throw new ValidationError(`Cannot transition an order from ${order.status} to ${toStatus}`);
    }

    await this.prisma.client.$transaction(async (tx: any) => {
      if (toStatus === 'DELIVERED') {
        for (const item of order.items) {
          const branchProduct = await tx.branchProduct.findUnique({
            where: { branchId_variantId: { branchId: order.branchId, variantId: item.variantId } },
          });
          if (branchProduct) {
            await tx.branchProduct.update({
              where: { id: branchProduct.id },
              data: {
                stock: branchProduct.stock - item.quantity,
                reservedStock: branchProduct.reservedStock - item.quantity,
              },
            });
            await tx.inventoryMovement.create({
              data: {
                branchProductId: branchProduct.id,
                type: 'SALE',
                quantityChange: -item.quantity,
                note: `Order ${order.orderNumber} delivered`,
                createdByUserId: actorUserId,
              },
            });
          }
        }
      }

      if (toStatus === 'CANCELLED') {
        for (const item of order.items) {
          const branchProduct = await tx.branchProduct.findUnique({
            where: { branchId_variantId: { branchId: order.branchId, variantId: item.variantId } },
          });
          if (branchProduct) {
            await tx.branchProduct.update({
              where: { id: branchProduct.id },
              data: { reservedStock: branchProduct.reservedStock - item.quantity },
            });
          }
        }
      }

      await tx.order.update({
        where: { id },
        data: {
          status: toStatus,
          ...(toStatus === 'CONFIRMED' && { confirmedAt: new Date() }),
        },
      });

      await tx.orderStatusHistory.create({
        data: {
          orderId: id,
          fromStatus: order.status,
          toStatus,
          note,
          changedByUserId: actorUserId,
        },
      });

      const fulfillmentStatus = FULFILLMENT_STATUS_BY_ORDER_STATUS[toStatus];
      if (fulfillmentStatus) {
        await tx.fulfillment.updateMany({
          where: { orderId: id },
          data: {
            status: fulfillmentStatus,
            ...(toStatus === 'DELIVERED' && { completedAt: new Date(), receivedByName, note }),
          },
        });
      }
    });

    const eventType = STATUS_EVENT[toStatus];
    if (eventType) {
      await this.eventsService.emit(
        eventType,
        { orderId: id, orderNumber: order.orderNumber, fromStatus: order.status, toStatus },
        order.contactId,
      );
    }

    return this.findOne(id);
  }
}
