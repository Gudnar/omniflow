import { OrdersService } from './orders.service';
import { NotFoundError, ValidationError } from '@omniflow/utils';

function order(overrides: any = {}) {
  return {
    id: 'o1',
    orderNumber: 'ORD-TEST',
    status: 'CONFIRMED',
    branchId: 'b1',
    subtotal: '50',
    discount: '0',
    shipping: '0',
    tax: '0',
    total: '50',
    items: [{ id: 'oi1', variantId: 'v1', quantity: 2 }],
    ...overrides,
  };
}

describe('OrdersService', () => {
  let service: OrdersService;
  let prisma: any;
  let tx: any;
  let eventsService: any;
  let messagesService: any;
  let queueService: any;
  let deliveryProviderConfigService: any;

  beforeEach(() => {
    tx = {
      branchProduct: { findUnique: jest.fn(), update: jest.fn() },
      inventoryMovement: { create: jest.fn() },
      order: { update: jest.fn() },
      orderStatusHistory: { create: jest.fn() },
      fulfillment: { updateMany: jest.fn() },
    };
    prisma = {
      client: {
        order: { findUnique: jest.fn(), findMany: jest.fn(), update: jest.fn() },
        orderStatusHistory: { findMany: jest.fn() },
        fulfillment: { updateMany: jest.fn() },
        cart: { findUnique: jest.fn() },
        commerceSession: { findUnique: jest.fn() },
        $transaction: jest.fn((cb: any) => cb(tx)),
      },
    };
    eventsService = { emit: jest.fn() };
    messagesService = { create: jest.fn() };
    queueService = { enqueueDeliveryNotifyForOrder: jest.fn() };
    deliveryProviderConfigService = { resolveForBranch: jest.fn().mockResolvedValue(null) };
    service = new OrdersService(prisma, eventsService, messagesService, queueService, deliveryProviderConfigService);
  });

  describe('findOne', () => {
    it('throws NotFoundError when missing', async () => {
      prisma.client.order.findUnique.mockResolvedValue(null);
      await expect(service.findOne('o1')).rejects.toThrow(NotFoundError);
    });

    it('serializes Decimal fields to plain numbers', async () => {
      prisma.client.order.findUnique.mockResolvedValue(order());
      const result = await service.findOne('o1');
      expect(result.total).toBe(50);
    });

    it('returns the order when its branch is in the caller\'s allowed set', async () => {
      prisma.client.order.findUnique.mockResolvedValue(order({ branchId: 'b1' }));
      const result = await service.findOne('o1', ['b1', 'b2']);
      expect(result.id).toBe('o1');
    });

    it('throws NotFoundError (not Forbidden) for an order outside the caller\'s branches — never reveals it exists', async () => {
      prisma.client.order.findUnique.mockResolvedValue(order({ branchId: 'other-branch' }));
      await expect(service.findOne('o1', ['b1'])).rejects.toThrow(NotFoundError);
    });

    it('throws NotFoundError for a branchless order when the caller is branch-restricted', async () => {
      prisma.client.order.findUnique.mockResolvedValue(order({ branchId: null }));
      await expect(service.findOne('o1', ['b1'])).rejects.toThrow(NotFoundError);
    });

    it('is unrestricted when branchIds is empty', async () => {
      prisma.client.order.findUnique.mockResolvedValue(order({ branchId: 'any-branch' }));
      const result = await service.findOne('o1');
      expect(result.id).toBe('o1');
    });
  });

  describe('listForContact', () => {
    it('orders newest first and serializes each order', async () => {
      prisma.client.order.findMany.mockResolvedValue([order()]);
      const result = await service.listForContact('c1');
      expect(prisma.client.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { contactId: 'c1' }, orderBy: { createdAt: 'desc' } }),
      );
      expect(result[0].total).toBe(50);
    });
  });

  describe('list', () => {
    it('applies optional status/branchId filters', async () => {
      prisma.client.order.findMany.mockResolvedValue([]);
      await service.list({ status: 'PENDING', branchId: 'b1' } as any);
      expect(prisma.client.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { status: 'PENDING', branchId: 'b1' } }),
      );
    });

    it('returns everything when no filters are given', async () => {
      prisma.client.order.findMany.mockResolvedValue([]);
      await service.list({} as any);
      expect(prisma.client.order.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: {} }));
    });

    it('restricts to the caller\'s branches when branchIds is non-empty and no specific branch was requested', async () => {
      prisma.client.order.findMany.mockResolvedValue([]);
      await service.list({} as any, ['b1', 'b2']);
      expect(prisma.client.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { branchId: { in: ['b1', 'b2'] } } }),
      );
    });

    it('allows a specific branchId query when it is one of the caller\'s allowed branches', async () => {
      prisma.client.order.findMany.mockResolvedValue([]);
      await service.list({ branchId: 'b1' } as any, ['b1', 'b2']);
      expect(prisma.client.order.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { branchId: 'b1' } }));
    });

    it('returns nothing — never queries — for a branchId outside the caller\'s allowed branches', async () => {
      const result = await service.list({ branchId: 'other-branch' } as any, ['b1']);
      expect(result).toEqual([]);
      expect(prisma.client.order.findMany).not.toHaveBeenCalled();
    });
  });

  describe('transition graph', () => {
    it.each([
      ['PENDING', 'PREPARING'],
      ['CONFIRMED', 'READY'],
      ['PREPARING', 'DELIVERED'],
      ['READY', 'PENDING'],
      ['DELIVERED', 'PREPARING'],
      ['CANCELLED', 'CONFIRMED'],
    ])('rejects the illegal jump %s -> %s', async (from, to) => {
      prisma.client.order.findUnique.mockResolvedValue(order({ status: from }));
      await expect(service.setStatus('o1', 'u1', { status: to } as any)).rejects.toThrow(ValidationError);
      expect(prisma.client.$transaction).not.toHaveBeenCalled();
    });

    it.each([
      ['PENDING', 'CONFIRMED'],
      ['CONFIRMED', 'PREPARING'],
      ['PREPARING', 'READY'],
      ['READY', 'DELIVERED'],
      ['PENDING', 'CANCELLED'],
      ['CONFIRMED', 'CANCELLED'],
    ])('allows the legal transition %s -> %s', async (from, to) => {
      prisma.client.order.findUnique.mockResolvedValue(order({ status: from }));
      tx.branchProduct.findUnique.mockResolvedValue({ id: 'bp1', stock: 10, reservedStock: 2 });

      await service.setStatus('o1', 'u1', { status: to } as any);

      expect(tx.order.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'o1' }, data: expect.objectContaining({ status: to }) }),
      );
      expect(tx.orderStatusHistory.create).toHaveBeenCalledWith({
        data: { orderId: 'o1', fromStatus: from, toStatus: to, note: undefined, changedByUserId: 'u1' },
      });
    });
  });

  describe('DELIVERED', () => {
    it('deducts stock and reservedStock and writes a SALE movement per item', async () => {
      prisma.client.order.findUnique.mockResolvedValue(order({ status: 'READY' }));
      tx.branchProduct.findUnique.mockResolvedValue({ id: 'bp1', stock: 10, reservedStock: 2 });

      await service.setStatus('o1', 'u1', { status: 'DELIVERED' } as any);

      expect(tx.branchProduct.update).toHaveBeenCalledWith({
        where: { id: 'bp1' },
        data: { stock: 8, reservedStock: 0 },
      });
      expect(tx.inventoryMovement.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ branchProductId: 'bp1', type: 'SALE', quantityChange: -2 }),
      });
    });
  });

  describe('CANCELLED', () => {
    it('releases reservedStock without touching stock or writing a movement', async () => {
      prisma.client.order.findUnique.mockResolvedValue(order({ status: 'CONFIRMED' }));
      tx.branchProduct.findUnique.mockResolvedValue({ id: 'bp1', stock: 10, reservedStock: 2 });

      await service.cancel('o1', 'u1', {} as any);

      expect(tx.branchProduct.update).toHaveBeenCalledWith({
        where: { id: 'bp1' },
        data: { reservedStock: 0 },
      });
      expect(tx.inventoryMovement.create).not.toHaveBeenCalled();
    });
  });

  describe('Fulfillment sync (Phase 18)', () => {
    it('does not touch fulfillment on a transition with no mapping (e.g. CONFIRMED->PREPARING)', async () => {
      prisma.client.order.findUnique.mockResolvedValue(order({ status: 'CONFIRMED' }));
      await service.setStatus('o1', 'u1', { status: 'PREPARING' } as any);
      expect(tx.fulfillment.updateMany).not.toHaveBeenCalled();
    });

    it('syncs fulfillment to READY when the order becomes READY', async () => {
      prisma.client.order.findUnique.mockResolvedValue(order({ status: 'PREPARING' }));
      await service.setStatus('o1', 'u1', { status: 'READY' } as any);
      expect(tx.fulfillment.updateMany).toHaveBeenCalledWith({
        where: { orderId: 'o1' },
        data: { status: 'READY' },
      });
    });

    it('syncs fulfillment to CANCELLED when the order is cancelled', async () => {
      prisma.client.order.findUnique.mockResolvedValue(order({ status: 'CONFIRMED' }));
      tx.branchProduct.findUnique.mockResolvedValue({ id: 'bp1', stock: 10, reservedStock: 2 });
      await service.cancel('o1', 'u1', {} as any);
      expect(tx.fulfillment.updateMany).toHaveBeenCalledWith({
        where: { orderId: 'o1' },
        data: { status: 'CANCELLED' },
      });
    });

    it('marks fulfillment COMPLETED and captures receivedByName/note on DELIVERED', async () => {
      prisma.client.order.findUnique.mockResolvedValue(order({ status: 'READY' }));
      tx.branchProduct.findUnique.mockResolvedValue({ id: 'bp1', stock: 10, reservedStock: 2 });

      await service.setStatus('o1', 'u1', { status: 'DELIVERED', note: 'dejado en recepción', receivedByName: 'Juan Perez' } as any);

      expect(tx.fulfillment.updateMany).toHaveBeenCalledWith({
        where: { orderId: 'o1' },
        data: {
          status: 'COMPLETED',
          completedAt: expect.any(Date),
          receivedByName: 'Juan Perez',
          note: 'dejado en recepción',
        },
      });
    });
  });

  describe('confirm', () => {
    it('only works from PENDING', async () => {
      prisma.client.order.findUnique.mockResolvedValue(order({ status: 'CONFIRMED' }));
      await expect(service.confirm('o1', 'u1')).rejects.toThrow(ValidationError);
    });

    it('transitions PENDING to CONFIRMED and stamps confirmedAt', async () => {
      prisma.client.order.findUnique.mockResolvedValue(order({ status: 'PENDING', contactId: 'c1' }));

      await service.confirm('o1', 'u1');

      expect(tx.order.update).toHaveBeenCalledWith({
        where: { id: 'o1' },
        data: { status: 'CONFIRMED', confirmedAt: expect.any(Date) },
      });
      expect(eventsService.emit).toHaveBeenCalledWith(
        'order.confirmed',
        { orderId: 'o1', orderNumber: 'ORD-TEST', fromStatus: 'PENDING', toStatus: 'CONFIRMED', productIds: [undefined], productNames: [undefined] },
        'c1',
      );
    });

    it('enqueues a Telegram notify when the branch is LOCAL_DELIVERY + TELEGRAM_NOTIFY + IMMEDIATE', async () => {
      prisma.client.order.findUnique.mockResolvedValue(
        order({ status: 'PENDING', tenantId: 't1', branchId: 'b1', fulfillmentType: 'LOCAL_DELIVERY' }),
      );
      deliveryProviderConfigService.resolveForBranch.mockResolvedValue({ type: 'TELEGRAM_NOTIFY', operationMode: 'IMMEDIATE' });

      await service.confirm('o1', 'u1');

      expect(queueService.enqueueDeliveryNotifyForOrder).toHaveBeenCalledWith('t1', 'o1');
    });

    it('does not enqueue anything for a ROUTE_BASED branch', async () => {
      prisma.client.order.findUnique.mockResolvedValue(
        order({ status: 'PENDING', tenantId: 't1', branchId: 'b1', fulfillmentType: 'LOCAL_DELIVERY' }),
      );
      deliveryProviderConfigService.resolveForBranch.mockResolvedValue({ type: 'TELEGRAM_NOTIFY', operationMode: 'ROUTE_BASED' });

      await service.confirm('o1', 'u1');

      expect(queueService.enqueueDeliveryNotifyForOrder).not.toHaveBeenCalled();
    });

    it('does not enqueue anything for a PICKUP order', async () => {
      prisma.client.order.findUnique.mockResolvedValue(
        order({ status: 'PENDING', tenantId: 't1', branchId: 'b1', fulfillmentType: 'PICKUP' }),
      );
      deliveryProviderConfigService.resolveForBranch.mockResolvedValue({ type: 'TELEGRAM_NOTIFY', operationMode: 'IMMEDIATE' });

      await service.confirm('o1', 'u1');

      expect(deliveryProviderConfigService.resolveForBranch).not.toHaveBeenCalled();
      expect(queueService.enqueueDeliveryNotifyForOrder).not.toHaveBeenCalled();
    });
  });

  describe('updateFulfillment', () => {
    it('requires addressId for non-PICKUP fulfillment', async () => {
      prisma.client.order.findUnique.mockResolvedValue(order());
      await expect(
        service.updateFulfillment('o1', { fulfillmentType: 'SHIPPING' } as any),
      ).rejects.toThrow(ValidationError);
    });

    it('rejects changing fulfillment on a completed order', async () => {
      prisma.client.order.findUnique.mockResolvedValue(order({ status: 'DELIVERED' }));
      await expect(
        service.updateFulfillment('o1', { fulfillmentType: 'PICKUP' } as any),
      ).rejects.toThrow(ValidationError);
    });

    it('updates fulfillmentType and addressId', async () => {
      prisma.client.order.findUnique.mockResolvedValue(order());
      prisma.client.order.update.mockResolvedValue({});

      await service.updateFulfillment('o1', { fulfillmentType: 'SHIPPING', addressId: 'a1' } as any);

      expect(prisma.client.order.update).toHaveBeenCalledWith({
        where: { id: 'o1' },
        data: { fulfillmentType: 'SHIPPING', addressId: 'a1' },
      });
      expect(prisma.client.fulfillment.updateMany).toHaveBeenCalledWith({
        where: { orderId: 'o1' },
        data: { type: 'SHIPPING', addressId: 'a1' },
      });
    });

    it('also updates the linked fulfillment scheduledAt when provided', async () => {
      prisma.client.order.findUnique.mockResolvedValue(order());
      prisma.client.order.update.mockResolvedValue({});

      await service.updateFulfillment('o1', {
        fulfillmentType: 'PICKUP',
        scheduledAt: '2026-01-05T15:00:00.000Z',
      } as any);

      expect(prisma.client.fulfillment.updateMany).toHaveBeenCalledWith({
        where: { orderId: 'o1' },
        data: { type: 'PICKUP', addressId: undefined, scheduledAt: new Date('2026-01-05T15:00:00.000Z') },
      });
    });
  });

  describe('updateTrackingCode', () => {
    it('verifies the order exists then sets the tracking code', async () => {
      prisma.client.order.findUnique.mockResolvedValue(order());

      await service.updateTrackingCode('o1', { trackingCode: 'GUIA-123' } as any);

      expect(prisma.client.order.update).toHaveBeenCalledWith({
        where: { id: 'o1' },
        data: { trackingCode: 'GUIA-123' },
      });
    });

    it('throws NotFoundError when the order does not exist', async () => {
      prisma.client.order.findUnique.mockResolvedValue(null);
      await expect(service.updateTrackingCode('missing', { trackingCode: 'X' } as any)).rejects.toThrow(NotFoundError);
    });
  });

  describe('listStatusHistory', () => {
    it('verifies the order exists then lists history newest-first', async () => {
      prisma.client.order.findUnique.mockResolvedValue(order());
      prisma.client.orderStatusHistory.findMany.mockResolvedValue([]);

      await service.listStatusHistory('o1');

      expect(prisma.client.orderStatusHistory.findMany).toHaveBeenCalledWith({
        where: { orderId: 'o1' },
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  describe('sendReceipt', () => {
    const fullOrder = order({
      cartId: 'c1',
      currency: 'BOB',
      fulfillmentType: 'PICKUP',
      items: [{ id: 'oi1', productNameSnapshot: 'Pizza Muzzarella', quantity: 2, unitPrice: '25', discount: '0', subtotal: '50' }],
    });

    it('throws ValidationError when the order\'s cart has no commerce session', async () => {
      prisma.client.order.findUnique.mockResolvedValue(fullOrder);
      prisma.client.cart.findUnique.mockResolvedValue({ commerceSessionId: null });

      await expect(service.sendReceipt('o1', 'u1')).rejects.toThrow(ValidationError);
      expect(messagesService.create).not.toHaveBeenCalled();
    });

    it('throws ValidationError when the commerce session has no linked conversation', async () => {
      prisma.client.order.findUnique.mockResolvedValue(fullOrder);
      prisma.client.cart.findUnique.mockResolvedValue({ commerceSessionId: 's1' });
      prisma.client.commerceSession.findUnique.mockResolvedValue({ conversationId: null });

      await expect(service.sendReceipt('o1', 'u1')).rejects.toThrow(ValidationError);
      expect(messagesService.create).not.toHaveBeenCalled();
    });

    it('sends a formatted TEXT message to the linked conversation', async () => {
      prisma.client.order.findUnique.mockResolvedValue(fullOrder);
      prisma.client.cart.findUnique.mockResolvedValue({ commerceSessionId: 's1' });
      prisma.client.commerceSession.findUnique.mockResolvedValue({ conversationId: 'conv1' });
      messagesService.create.mockResolvedValue({ id: 'm1' });

      const result = await service.sendReceipt('o1', 'u1');

      expect(messagesService.create).toHaveBeenCalledWith('conv1', 'u1', {
        direction: 'OUTBOUND',
        type: 'TEXT',
        content: expect.stringContaining('Pizza Muzzarella x2 — BOB 50.00'),
      });
      const [, , dto] = messagesService.create.mock.calls[0];
      expect(dto.content).toContain('ORD-TEST');
      expect(dto.content).toContain('Total: BOB 50.00');
      expect(result).toEqual({ success: true, message: { id: 'm1' } });
    });

    it('includes a preparation notice when a PICKUP order has a flagged item', async () => {
      const prepOrder = order({
        cartId: 'c1',
        currency: 'BOB',
        fulfillmentType: 'PICKUP',
        items: [
          {
            id: 'oi1',
            productNameSnapshot: 'Helado de vainilla',
            quantity: 1,
            unitPrice: '30',
            discount: '0',
            subtotal: '30',
            requiresPreparationSnapshot: true,
            preparationReasonSnapshot: 'Requiere congelación',
            preparationMinutesSnapshot: 20,
          },
        ],
      });
      prisma.client.order.findUnique.mockResolvedValue(prepOrder);
      prisma.client.cart.findUnique.mockResolvedValue({ commerceSessionId: 's1' });
      prisma.client.commerceSession.findUnique.mockResolvedValue({ conversationId: 'conv1' });
      messagesService.create.mockResolvedValue({ id: 'm1' });

      await service.sendReceipt('o1', 'u1');

      const [, , dto] = messagesService.create.mock.calls[0];
      expect(dto.content).toContain('Requiere congelación');
      expect(dto.content).toContain('aprox. 20 min');
    });

    it('omits the preparation notice for a non-PICKUP order even with a flagged item', async () => {
      const deliveryOrder = order({
        cartId: 'c1',
        currency: 'BOB',
        fulfillmentType: 'LOCAL_DELIVERY',
        items: [
          {
            id: 'oi1',
            productNameSnapshot: 'Helado de vainilla',
            quantity: 1,
            unitPrice: '30',
            discount: '0',
            subtotal: '30',
            requiresPreparationSnapshot: true,
            preparationReasonSnapshot: 'Requiere congelación',
            preparationMinutesSnapshot: 20,
          },
        ],
      });
      prisma.client.order.findUnique.mockResolvedValue(deliveryOrder);
      prisma.client.cart.findUnique.mockResolvedValue({ commerceSessionId: 's1' });
      prisma.client.commerceSession.findUnique.mockResolvedValue({ conversationId: 'conv1' });
      messagesService.create.mockResolvedValue({ id: 'm1' });

      await service.sendReceipt('o1', 'u1');

      const [, , dto] = messagesService.create.mock.calls[0];
      expect(dto.content).not.toContain('Requiere congelación');
    });
  });
});
