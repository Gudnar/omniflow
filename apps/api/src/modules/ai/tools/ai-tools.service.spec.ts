import { AiToolsService } from './ai-tools.service';
import { ValidationError, NotFoundError } from '@omniflow/utils';

describe('AiToolsService', () => {
  let service: AiToolsService;
  let prisma: any;
  let cartsService: any;
  let commerceSessionsService: any;
  let ordersService: any;
  let appointmentsService: any;
  let bookingServicesService: any;
  let deliveryZonesService: any;

  const ctx = { tenantId: 't1', contactId: 'c1', conversationId: 'conv1', agentId: 'agent1' };
  const session = { id: 'sess1', contactId: 'c1', conversationId: 'conv1', branchId: 'b1' };

  beforeEach(() => {
    prisma = {
      client: {
        commerceSession: { findFirst: jest.fn().mockResolvedValue(session), create: jest.fn() },
        ecommerceStore: { findFirst: jest.fn() },
        ecommerceStoreBranch: { findFirst: jest.fn() },
        branch: { findFirst: jest.fn() },
        branchProduct: { findMany: jest.fn(), findUnique: jest.fn() },
        bookingResource: { findMany: jest.fn() },
      },
    };
    cartsService = { addItem: jest.fn(), updateItem: jest.fn(), removeItem: jest.fn(), checkout: jest.fn() };
    commerceSessionsService = { getOrCreateCart: jest.fn().mockResolvedValue({ id: 'cart1', items: [] }) };
    ordersService = { listForContact: jest.fn(), cancel: jest.fn() };
    appointmentsService = { create: jest.fn(), reschedule: jest.fn(), cancel: jest.fn(), findOne: jest.fn(), getAvailability: jest.fn() };
    bookingServicesService = { list: jest.fn() };
    deliveryZonesService = { calculateFee: jest.fn() };
    service = new AiToolsService(
      prisma,
      cartsService,
      commerceSessionsService,
      ordersService,
      appointmentsService,
      bookingServicesService,
      deliveryZonesService,
    );
  });

  describe('execute dispatch', () => {
    it('returns an error for an unregistered tool name', async () => {
      const result = await service.execute('delete_everything', '{}', ctx);
      expect(result).toEqual({ ok: false, error: 'Unknown tool: delete_everything' });
    });

    it('returns an error for unparsable arguments JSON', async () => {
      const result = await service.execute('get_cart', '{not json', ctx);
      expect(result).toEqual({ ok: false, error: 'Invalid arguments JSON' });
    });

    it('wraps a handler error into a failed result instead of throwing', async () => {
      const result = await service.execute('check_stock', '{}', ctx);
      expect(result.ok).toBe(false);
      expect(result.error).toContain('variantId');
    });

    it('returns ok:true with the handler result on success', async () => {
      const result = await service.execute('get_cart', '{}', ctx);
      expect(result).toEqual({ ok: true, data: { id: 'cart1', items: [] } });
    });
  });

  describe('session/cart resolution', () => {
    it('reuses an existing CommerceSession for this (contact, conversation) pair', async () => {
      await service.execute('get_cart', '{}', ctx);
      expect(prisma.client.commerceSession.findFirst).toHaveBeenCalledWith({
        where: { contactId: 'c1', conversationId: 'conv1' },
        orderBy: { createdAt: 'desc' },
      });
      expect(prisma.client.commerceSession.create).not.toHaveBeenCalled();
      expect(commerceSessionsService.getOrCreateCart).toHaveBeenCalledWith('sess1');
    });

    it('creates a new session with the store\'s default branch when none exists yet', async () => {
      prisma.client.commerceSession.findFirst.mockResolvedValue(null);
      prisma.client.ecommerceStore.findFirst.mockResolvedValue({ id: 'store1' });
      prisma.client.ecommerceStoreBranch.findFirst.mockResolvedValue({ branchId: 'b1' });
      prisma.client.commerceSession.create.mockResolvedValue({ id: 'sess2', branchId: 'b1' });

      await service.execute('get_cart', '{}', ctx);

      expect(prisma.client.commerceSession.create).toHaveBeenCalledWith({
        data: { contactId: 'c1', conversationId: 'conv1', storeId: 'store1', branchId: 'b1' },
      });
      expect(commerceSessionsService.getOrCreateCart).toHaveBeenCalledWith('sess2');
    });
  });

  describe('ecommerce tools', () => {
    it('check_stock validates variantId is present', async () => {
      const result = await service.execute('check_stock', '{}', ctx);
      expect(result.ok).toBe(false);
    });

    it('check_stock reports unavailable when the branch has no row for that variant', async () => {
      prisma.client.branchProduct.findUnique.mockResolvedValue(null);
      const result = await service.execute('check_stock', '{"variantId":"v1"}', ctx);
      expect(result).toEqual({ ok: true, data: { available: false, stock: 0 } });
    });

    it('check_stock reports availability and stock from the resolved branch', async () => {
      prisma.client.branchProduct.findUnique.mockResolvedValue({ status: 'AVAILABLE', stock: 5 });
      const result = await service.execute('check_stock', '{"variantId":"v1"}', ctx);
      expect(result).toEqual({ ok: true, data: { available: true, stock: 5 } });
      expect(prisma.client.branchProduct.findUnique).toHaveBeenCalledWith({ where: { branchId_variantId: { branchId: 'b1', variantId: 'v1' } } });
    });

    it('add_to_cart validates quantity is at least 1', async () => {
      const result = await service.execute('add_to_cart', '{"variantId":"v1","quantity":0}', ctx);
      expect(result.ok).toBe(false);
    });

    it('add_to_cart resolves the cart then delegates to CartsService.addItem', async () => {
      cartsService.addItem.mockResolvedValue({ id: 'cart1' });
      const result = await service.execute('add_to_cart', '{"variantId":"v1","quantity":2}', ctx);
      expect(cartsService.addItem).toHaveBeenCalledWith('cart1', { variantId: 'v1', quantity: 2 });
      expect(result).toEqual({ ok: true, data: { id: 'cart1' } });
    });

    it('create_checkout and create_order both delegate to the same CartsService.checkout call', async () => {
      cartsService.checkout.mockResolvedValue({ id: 'order1', orderNumber: 'ORD-1' });

      await service.execute('create_checkout', '{"fulfillmentType":"PICKUP"}', ctx);
      await service.execute('create_order', '{"fulfillmentType":"PICKUP"}', ctx);

      expect(cartsService.checkout).toHaveBeenCalledTimes(2);
      expect(cartsService.checkout).toHaveBeenCalledWith('cart1', { fulfillmentType: 'PICKUP', addressId: undefined });
    });

    it('get_order only ever returns an order belonging to this conversation\'s contact', async () => {
      ordersService.listForContact.mockResolvedValue([{ id: 'o1', orderNumber: 'ORD-1' }]);
      const result = await service.execute('get_order', '{"orderNumber":"ORD-404"}', ctx);
      expect(result.ok).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('get_order returns the matching order when it belongs to this contact', async () => {
      ordersService.listForContact.mockResolvedValue([{ id: 'o1', orderNumber: 'ORD-1' }]);
      const result = await service.execute('get_order', '{"orderNumber":"ORD-1"}', ctx);
      expect(result).toEqual({ ok: true, data: { id: 'o1', orderNumber: 'ORD-1' } });
    });

    it('cancel_order resolves the order by number within this contact\'s own orders before cancelling', async () => {
      ordersService.listForContact.mockResolvedValue([{ id: 'o1', orderNumber: 'ORD-1' }]);
      ordersService.cancel.mockResolvedValue({ id: 'o1', status: 'CANCELLED' });

      await service.execute('cancel_order', '{"orderNumber":"ORD-1"}', ctx);

      expect(ordersService.cancel).toHaveBeenCalledWith('o1', undefined, {});
    });
  });

  describe('booking tools', () => {
    it('book_appointment resolves the branch/session and passes commerceSessionId through to AppointmentsService.create', async () => {
      appointmentsService.create.mockResolvedValue({ id: 'a1' });

      await service.execute('book_appointment', '{"serviceId":"s1","startAt":"2026-03-10T14:30:00.000Z","patientName":"Juan"}', ctx);

      expect(appointmentsService.create).toHaveBeenCalledWith({
        contactId: 'c1',
        branchId: 'b1',
        serviceIds: ['s1'],
        startAt: '2026-03-10T14:30:00.000Z',
        commerceSessionId: 'sess1',
        patientName: 'Juan',
      });
    });

    it('get_appointment refuses an appointment that does not belong to this conversation\'s contact', async () => {
      appointmentsService.findOne.mockResolvedValue({ id: 'ap1', contactId: 'someone-else' });
      const result = await service.execute('get_appointment', '{"appointmentId":"ap1"}', ctx);
      expect(result.ok).toBe(false);
    });

    it('get_appointment returns it when it does belong to this contact', async () => {
      appointmentsService.findOne.mockResolvedValue({ id: 'ap1', contactId: 'c1' });
      const result = await service.execute('get_appointment', '{"appointmentId":"ap1"}', ctx);
      expect(result).toEqual({ ok: true, data: { id: 'ap1', contactId: 'c1' } });
    });

    it('cancel_appointment refuses to cancel an appointment belonging to a different contact', async () => {
      appointmentsService.findOne.mockResolvedValue({ id: 'ap1', contactId: 'someone-else' });
      const result = await service.execute('cancel_appointment', '{"appointmentId":"ap1"}', ctx);
      expect(result.ok).toBe(false);
      expect(appointmentsService.cancel).not.toHaveBeenCalled();
    });

    it('reschedule_appointment refuses an appointment belonging to a different contact', async () => {
      appointmentsService.findOne.mockResolvedValue({ id: 'ap1', contactId: 'someone-else' });
      const result = await service.execute('reschedule_appointment', '{"appointmentId":"ap1","startAt":"2026-03-10T15:00:00.000Z"}', ctx);
      expect(result.ok).toBe(false);
      expect(appointmentsService.reschedule).not.toHaveBeenCalled();
    });

    it('search_booking_services filters to ACTIVE services and an optional name match', async () => {
      bookingServicesService.list.mockResolvedValue([
        { id: 's1', name: 'Corte de cabello', status: 'ACTIVE', durationMinutes: 30, price: '50' },
        { id: 's2', name: 'Manicure', status: 'ACTIVE', durationMinutes: 45, price: '80' },
        { id: 's3', name: 'Viejo servicio', status: 'ARCHIVED', durationMinutes: 20, price: '10' },
      ]);
      const result = await service.execute('search_booking_services', '{"query":"corte"}', ctx);
      expect(result).toEqual({ ok: true, data: [{ id: 's1', name: 'Corte de cabello', durationMinutes: 30, price: 50 }] });
    });
  });
});
