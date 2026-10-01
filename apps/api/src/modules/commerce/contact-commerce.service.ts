import { Injectable } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { ValidationError } from '@omniflow/utils';
import { PrismaService } from '../prisma/prisma.service';
import { ContactsService } from '../contacts/contacts.service';
import { OrdersService } from './orders.service';
import { AppointmentsService } from '../booking/appointments.service';

// A generated link is valid for 48h — long enough for a customer to browse
// and come back, short enough that a leaked link (forwarded, screenshotted)
// doesn't stay usable indefinitely. Regenerating always replaces the
// previous token outright (see PATCH-style upsert below), invalidating it.
const STOREFRONT_LINK_TTL_MS = 48 * 60 * 60 * 1000;

const CART_INCLUDE = {
  items: { include: { product: { select: { id: true, name: true } }, variant: { select: { id: true, name: true, sku: true } } } },
};

function serializeCart(cart: any) {
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

@Injectable()
export class ContactCommerceService {
  constructor(
    private prisma: PrismaService,
    private contactsService: ContactsService,
    private ordersService: OrdersService,
    private appointmentsService: AppointmentsService,
  ) {}

  async getActiveCart(contactId: string) {
    await this.contactsService.findOne(contactId);
    const cart = await this.prisma.client.cart.findFirst({
      where: { contactId, status: 'ACTIVE' },
      include: CART_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
    return cart ? serializeCart(cart) : null;
  }

  async listOrders(contactId: string) {
    await this.contactsService.findOne(contactId);
    return this.ordersService.listForContact(contactId);
  }

  // Read-only union of Orders + Appointments for one contact — a "purchase
  // history" view without merging the underlying models. Order and
  // Appointment stay deliberately separate ("confirmed purchase" vs
  // "confirmed reservation", per CLAUDE.md); Fulfillment is the real
  // unification point already designed for either one. `date` is the
  // purchase date for an order but the appointment's own startAt for a
  // reservation, so an upcoming appointment sorts by when it happens, not
  // when it was booked.
  async listPurchases(contactId: string) {
    await this.contactsService.findOne(contactId);
    const [orders, appointments] = await Promise.all([
      this.ordersService.listForContact(contactId),
      this.appointmentsService.list({ contactId } as any),
    ]);

    const merged = [
      ...orders.map((order: any) => ({
        kind: 'order' as const,
        id: order.id,
        date: order.createdAt,
        label: order.orderNumber,
        status: order.status,
        total: order.total,
        currency: order.currency,
      })),
      ...appointments.map((appointment: any) => ({
        kind: 'appointment' as const,
        id: appointment.id,
        date: appointment.startAt,
        label: appointment.services?.[0]?.serviceNameSnapshot ?? 'Cita',
        status: appointment.status,
        total: appointment.total,
        currency: appointment.currency,
      })),
    ];

    return merged.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }

  // Manual trigger (operator button, today) for what will eventually be an
  // AI-agent tool: generates/renews a magic-link URL to the public
  // storefront, reusing the contact's existing open-conversation
  // CommerceSession when there is one — so anything the customer does on
  // the page (cart, location, checkout) lands in the exact same session the
  // conversation already sees via GET /contacts/:id/active-cart.
  async generateStorefrontLink(contactId: string) {
    await this.contactsService.findOne(contactId);

    const store = await this.prisma.client.ecommerceStore.findFirst({ where: {} });
    if (!store || store.status !== 'PUBLISHED') {
      throw new ValidationError('Publish the ecommerce store before sending storefront links');
    }

    const conversation = await this.prisma.client.conversation.findFirst({
      where: { contactId, status: { not: 'CLOSED' } },
      orderBy: { lastMessageAt: 'desc' },
    });

    const branchLink = await this.prisma.client.ecommerceStoreBranch.findFirst({ where: { storeId: store.id } });

    let session = await this.prisma.client.commerceSession.findFirst({
      where: { contactId, ...(conversation && { conversationId: conversation.id }) },
      orderBy: { createdAt: 'desc' },
    });

    const publicToken = randomBytes(32).toString('hex');
    const publicTokenExpiresAt = new Date(Date.now() + STOREFRONT_LINK_TTL_MS);

    if (session) {
      session = await this.prisma.client.commerceSession.update({
        where: { id: session.id },
        data: { publicToken, publicTokenExpiresAt },
      });
    } else {
      session = await this.prisma.client.commerceSession.create({
        data: {
          contactId,
          conversationId: conversation?.id,
          storeId: store.id,
          branchId: branchLink?.branchId,
          publicToken,
          publicTokenExpiresAt,
        },
      });
    }

    const baseUrl = process.env.STOREFRONT_BASE_URL || 'http://localhost:3000';
    return {
      url: `${baseUrl}/tienda/${store.slug}?s=${publicToken}`,
      expiresAt: publicTokenExpiresAt,
    };
  }
}
