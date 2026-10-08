import { Injectable } from '@nestjs/common';
import { ValidationError, NotFoundError } from '@omniflow/utils';
import { PrismaService } from '../../prisma/prisma.service';
import { CartsService } from '../../commerce/carts.service';
import { CommerceSessionsService } from '../../commerce/commerce-sessions.service';
import { OrdersService } from '../../commerce/orders.service';
import { AppointmentsService } from '../../booking/appointments.service';
import { BookingServicesService } from '../../booking/booking-services.service';
import { DeliveryZonesService } from '../../delivery/delivery-zones.service';
import { ToolContext, ToolExecutionResult } from './types';
import { getToolDefinition } from './registry';

// One handler method per tool name (`tool_<name>`), dispatched by name —
// keeps 21 small, independently testable methods instead of one giant
// switch, while still sharing DI/constructor setup. See types.ts for the
// authorization chain this sits inside (AiReplyService picks which tools to
// even OFFER the model, based on AiAgent.enabledTools; this service is only
// ever reached for a tool that was already offered).
@Injectable()
export class AiToolsService {
  constructor(
    private prisma: PrismaService,
    private cartsService: CartsService,
    private commerceSessionsService: CommerceSessionsService,
    private ordersService: OrdersService,
    private appointmentsService: AppointmentsService,
    private bookingServicesService: BookingServicesService,
    private deliveryZonesService: DeliveryZonesService,
  ) {}

  async execute(name: string, argsJson: string, ctx: ToolContext): Promise<ToolExecutionResult> {
    const definition = getToolDefinition(name);
    if (!definition) return { ok: false, error: `Unknown tool: ${name}` };

    let args: Record<string, unknown>;
    try {
      args = argsJson ? JSON.parse(argsJson) : {};
    } catch {
      return { ok: false, error: 'Invalid arguments JSON' };
    }

    const handler = (this as any)[`tool_${name}`] as ((args: any, ctx: ToolContext) => Promise<unknown>) | undefined;
    if (typeof handler !== 'function') return { ok: false, error: `No handler registered for tool: ${name}` };

    try {
      const data = await handler.call(this, args, ctx);
      return { ok: true, data };
    } catch (error: any) {
      return { ok: false, error: error?.message ?? 'Tool execution failed' };
    }
  }

  // ---- Shared resolution helpers -----------------------------------------

  // Every ecommerce/booking tool that touches a cart or creates an
  // appointment needs the same CommerceSession a human customer gets from
  // ContactCommerceService.generateStorefrontLink() — so anything the AI
  // does lands in the exact session the storefront link (if the agent also
  // sends one) would show, and vice versa. Reuses an existing session for
  // this (contact, conversation) pair; creates one, with a default branch,
  // only if none exists yet.
  private async resolveSession(ctx: ToolContext) {
    let session = await this.prisma.client.commerceSession.findFirst({
      where: { contactId: ctx.contactId, conversationId: ctx.conversationId },
      orderBy: { createdAt: 'desc' },
    });
    if (session) return session;

    const store = await this.prisma.client.ecommerceStore.findFirst({ where: {} });
    if (!store) throw new ValidationError('Esta tienda todavía no está configurada.');
    const branchLink = await this.prisma.client.ecommerceStoreBranch.findFirst({ where: { storeId: store.id } });

    return this.prisma.client.commerceSession.create({
      data: {
        contactId: ctx.contactId,
        conversationId: ctx.conversationId,
        storeId: store.id,
        branchId: branchLink?.branchId,
      },
    });
  }

  private async resolveBranchId(ctx: ToolContext): Promise<string> {
    const session = await this.resolveSession(ctx);
    if (session.branchId) return session.branchId;
    const branch = await this.prisma.client.branch.findFirst({ where: { status: 'ACTIVE' } });
    if (!branch) throw new ValidationError('No hay sucursales activas configuradas.');
    return branch.id;
  }

  private async resolveCart(ctx: ToolContext) {
    const session = await this.resolveSession(ctx);
    return this.commerceSessionsService.getOrCreateCart(session.id);
  }

  // ---- Ecommerce tools ----------------------------------------------------

  private async tool_search_products(args: { query?: string; categoryName?: string }, ctx: ToolContext) {
    const branchId = await this.resolveBranchId(ctx);
    const rows = await this.prisma.client.branchProduct.findMany({
      where: {
        branchId,
        status: 'AVAILABLE',
        stock: { gt: 0 },
        product: {
          status: 'ACTIVE',
          ...(args.query && { name: { contains: args.query, mode: 'insensitive' } }),
          ...(args.categoryName && { category: { name: { contains: args.categoryName, mode: 'insensitive' } } }),
        },
      },
      include: { product: { select: { name: true } }, variant: { select: { id: true, name: true, sku: true } } },
      take: 10,
    });
    return rows.map((r: any) => ({
      productName: r.product.name,
      variantId: r.variantId,
      variantName: r.variant.name,
      sku: r.variant.sku,
      price: Number(r.price),
      stock: r.stock,
    }));
  }

  private async tool_check_stock(args: { variantId: string }, ctx: ToolContext) {
    if (!args.variantId) throw new ValidationError('variantId es obligatorio');
    const branchId = await this.resolveBranchId(ctx);
    const row = await this.prisma.client.branchProduct.findUnique({ where: { branchId_variantId: { branchId, variantId: args.variantId } } });
    if (!row) return { available: false, stock: 0 };
    return { available: row.status === 'AVAILABLE' && row.stock > 0, stock: row.stock };
  }

  private async tool_find_branch(args: { query?: string }) {
    const branches = await this.prisma.client.branch.findMany({
      where: { status: 'ACTIVE', ...(args.query && { name: { contains: args.query, mode: 'insensitive' } }) },
      select: { id: true, name: true, address: true },
      take: 10,
    });
    return branches;
  }

  private async tool_get_price(args: { variantId: string }, ctx: ToolContext) {
    if (!args.variantId) throw new ValidationError('variantId es obligatorio');
    const branchId = await this.resolveBranchId(ctx);
    const row = await this.prisma.client.branchProduct.findUnique({ where: { branchId_variantId: { branchId, variantId: args.variantId } } });
    if (!row) throw new NotFoundError('BranchProduct');
    return { price: Number(row.price), compareAtPrice: row.compareAtPrice === null ? null : Number(row.compareAtPrice) };
  }

  private async tool_create_cart(args: unknown, ctx: ToolContext) {
    return this.resolveCart(ctx);
  }

  private async tool_get_cart(args: unknown, ctx: ToolContext) {
    return this.resolveCart(ctx);
  }

  private async tool_add_to_cart(args: { variantId: string; quantity: number }, ctx: ToolContext) {
    if (!args.variantId || !args.quantity || args.quantity < 1) {
      throw new ValidationError('variantId y quantity (mínimo 1) son obligatorios');
    }
    const cart = await this.resolveCart(ctx);
    return this.cartsService.addItem(cart.id, { variantId: args.variantId, quantity: args.quantity });
  }

  private async tool_modify_cart(args: { itemId: string; quantity: number }, ctx: ToolContext) {
    if (!args.itemId || !args.quantity || args.quantity < 1) {
      throw new ValidationError('itemId y quantity (mínimo 1) son obligatorios');
    }
    const cart = await this.resolveCart(ctx);
    return this.cartsService.updateItem(cart.id, args.itemId, { quantity: args.quantity });
  }

  private async tool_remove_from_cart(args: { itemId: string }, ctx: ToolContext) {
    if (!args.itemId) throw new ValidationError('itemId es obligatorio');
    const cart = await this.resolveCart(ctx);
    return this.cartsService.removeItem(cart.id, args.itemId);
  }

  private async checkout(args: { fulfillmentType: string; addressId?: string }, ctx: ToolContext) {
    if (!args.fulfillmentType) throw new ValidationError('fulfillmentType es obligatorio');
    const cart = await this.resolveCart(ctx);
    return this.cartsService.checkout(cart.id, { fulfillmentType: args.fulfillmentType as any, addressId: args.addressId });
  }

  private tool_create_checkout(args: { fulfillmentType: string; addressId?: string }, ctx: ToolContext) {
    return this.checkout(args, ctx);
  }

  private tool_create_order(args: { fulfillmentType: string; addressId?: string }, ctx: ToolContext) {
    return this.checkout(args, ctx);
  }

  private async tool_get_order(args: { orderNumber: string }, ctx: ToolContext) {
    if (!args.orderNumber) throw new ValidationError('orderNumber es obligatorio');
    const orders = await this.ordersService.listForContact(ctx.contactId);
    const order = orders.find((o: any) => o.orderNumber === args.orderNumber);
    if (!order) throw new NotFoundError('Order');
    return order;
  }

  private async tool_cancel_order(args: { orderNumber: string }, ctx: ToolContext) {
    if (!args.orderNumber) throw new ValidationError('orderNumber es obligatorio');
    const orders = await this.ordersService.listForContact(ctx.contactId);
    const order = orders.find((o: any) => o.orderNumber === args.orderNumber);
    if (!order) throw new NotFoundError('Order');
    return this.ordersService.cancel(order.id, undefined as any, {});
  }

  private async tool_request_location() {
    return { instruction: 'Pídele al cliente su dirección de entrega (o sugiérele el enlace de la tienda para compartir su ubicación real desde el navegador).' };
  }

  // Fase 20 — check_delivery_coverage/get_delivery_quote comparten este
  // handler (mismo patrón que checkout() más arriba para create_checkout/
  // create_order): misma consulta, dos nombres según la intención del agente.
  private async deliveryQuote(
    args: { zoneLabel?: string; latitude?: number; longitude?: number },
    ctx: ToolContext,
  ) {
    const branchId = await this.resolveBranchId(ctx);
    const cart = await this.resolveCart(ctx);
    const result = await this.deliveryZonesService.calculateFee(
      branchId,
      { zone: args.zoneLabel, latitude: args.latitude, longitude: args.longitude },
      Number(cart.subtotal),
    );
    if (!result.covered) {
      return { covered: false };
    }
    return { covered: true, fee: result.fee, currency: cart.currency };
  }

  private tool_check_delivery_coverage(args: { zoneLabel?: string; latitude?: number; longitude?: number }, ctx: ToolContext) {
    return this.deliveryQuote(args, ctx);
  }

  private tool_get_delivery_quote(args: { zoneLabel?: string; latitude?: number; longitude?: number }, ctx: ToolContext) {
    return this.deliveryQuote(args, ctx);
  }

  // ---- Booking tools --------------------------------------------------------

  private async tool_search_booking_services(args: { query?: string }) {
    const services = await this.bookingServicesService.list();
    const active = services.filter((s: any) => s.status === 'ACTIVE');
    const filtered = args.query ? active.filter((s: any) => s.name.toLowerCase().includes(args.query!.toLowerCase())) : active;
    return filtered.slice(0, 10).map((s: any) => ({ id: s.id, name: s.name, durationMinutes: s.durationMinutes, price: Number(s.price) }));
  }

  private async tool_get_available_slots(args: { serviceId: string; date: string }, ctx: ToolContext) {
    if (!args.serviceId || !args.date) throw new ValidationError('serviceId y date son obligatorios');
    const branchId = await this.resolveBranchId(ctx);
    return this.appointmentsService.getAvailability({ serviceId: args.serviceId, branchId, date: args.date } as any);
  }

  private async tool_find_best_specialist(args: { serviceId: string; date?: string }, ctx: ToolContext) {
    if (!args.serviceId) throw new ValidationError('serviceId es obligatorio');
    const branchId = await this.resolveBranchId(ctx);

    if (args.date) {
      const slots = await this.appointmentsService.getAvailability({ serviceId: args.serviceId, branchId, date: args.date } as any);
      const resourceIds = Array.from(new Set(slots.flatMap((s: any) => s.resourceIds)));
      if (!resourceIds.length) return [];
      const resources = await this.prisma.client.bookingResource.findMany({ where: { id: { in: resourceIds } }, select: { id: true, name: true, type: true } });
      return resources;
    }

    const resources = await this.prisma.client.bookingResource.findMany({
      where: { branchId, status: 'ACTIVE', services: { some: { serviceId: args.serviceId } } },
      select: { id: true, name: true, type: true },
    });
    return resources;
  }

  private async tool_book_appointment(args: { serviceId: string; startAt: string; patientName?: string }, ctx: ToolContext) {
    if (!args.serviceId || !args.startAt) throw new ValidationError('serviceId y startAt son obligatorios');
    const branchId = await this.resolveBranchId(ctx);
    const session = await this.resolveSession(ctx);
    return this.appointmentsService.create({
      contactId: ctx.contactId,
      branchId,
      serviceIds: [args.serviceId],
      startAt: args.startAt,
      commerceSessionId: session.id,
      ...(args.patientName && { patientName: args.patientName }),
    } as any);
  }

  private async tool_reschedule_appointment(args: { appointmentId: string; startAt: string }, ctx: ToolContext) {
    if (!args.appointmentId || !args.startAt) throw new ValidationError('appointmentId y startAt son obligatorios');
    const appointment = await this.appointmentsService.findOne(args.appointmentId);
    if (appointment.contactId !== ctx.contactId) throw new NotFoundError('Appointment');
    return this.appointmentsService.reschedule(args.appointmentId, { startAt: args.startAt } as any);
  }

  private async tool_cancel_appointment(args: { appointmentId: string }, ctx: ToolContext) {
    if (!args.appointmentId) throw new ValidationError('appointmentId es obligatorio');
    const appointment = await this.appointmentsService.findOne(args.appointmentId);
    if (appointment.contactId !== ctx.contactId) throw new NotFoundError('Appointment');
    return this.appointmentsService.cancel(args.appointmentId, undefined as any, {});
  }

  private async tool_get_appointment(args: { appointmentId: string }, ctx: ToolContext) {
    if (!args.appointmentId) throw new ValidationError('appointmentId es obligatorio');
    const appointment = await this.appointmentsService.findOne(args.appointmentId);
    if (appointment.contactId !== ctx.contactId) throw new NotFoundError('Appointment');
    return appointment;
  }
}
