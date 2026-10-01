import { ContactCommerceService } from './contact-commerce.service';
import { ValidationError } from '@omniflow/utils';

describe('ContactCommerceService', () => {
  let service: ContactCommerceService;
  let prisma: any;
  let contactsService: any;
  let ordersService: any;
  let appointmentsService: any;

  beforeEach(() => {
    prisma = {
      client: {
        cart: { findFirst: jest.fn() },
        ecommerceStore: { findFirst: jest.fn() },
        conversation: { findFirst: jest.fn() },
        ecommerceStoreBranch: { findFirst: jest.fn() },
        commerceSession: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
      },
    };
    contactsService = { findOne: jest.fn().mockResolvedValue({ id: 'c1' }) };
    ordersService = { listForContact: jest.fn().mockResolvedValue([]) };
    appointmentsService = { list: jest.fn().mockResolvedValue([]) };
    service = new ContactCommerceService(prisma, contactsService, ordersService, appointmentsService);
  });

  describe('getActiveCart', () => {
    it('returns null when the contact has no ACTIVE cart', async () => {
      prisma.client.cart.findFirst.mockResolvedValue(null);
      const result = await service.getActiveCart('c1');
      expect(result).toBeNull();
      expect(prisma.client.cart.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { contactId: 'c1', status: 'ACTIVE' } }),
      );
    });

    it('serializes the active cart when one exists', async () => {
      prisma.client.cart.findFirst.mockResolvedValue({
        id: 'cart-1',
        subtotal: '20.00',
        discount: '0',
        shipping: '0',
        tax: '0',
        total: '20.00',
        items: [],
      });

      const result = await service.getActiveCart('c1');
      expect(result.total).toBe(20);
    });
  });

  describe('listOrders', () => {
    it('verifies the contact exists then delegates to OrdersService', async () => {
      await service.listOrders('c1');
      expect(contactsService.findOne).toHaveBeenCalledWith('c1');
      expect(ordersService.listForContact).toHaveBeenCalledWith('c1');
    });
  });

  describe('listPurchases', () => {
    it('verifies the contact exists then merges orders and appointments sorted by date, most recent first', async () => {
      ordersService.listForContact.mockResolvedValue([
        { id: 'o1', orderNumber: 'ORD-AAA', status: 'CONFIRMED', total: 100, currency: 'BOB', createdAt: '2026-01-01T00:00:00.000Z' },
      ]);
      appointmentsService.list.mockResolvedValue([
        {
          id: 'a1',
          status: 'CONFIRMED',
          total: 80,
          currency: 'BOB',
          startAt: '2026-01-15T09:00:00.000Z',
          services: [{ serviceNameSnapshot: 'Corte de cabello' }],
        },
      ]);

      const result = await service.listPurchases('c1');

      expect(contactsService.findOne).toHaveBeenCalledWith('c1');
      expect(appointmentsService.list).toHaveBeenCalledWith({ contactId: 'c1' });
      expect(result).toEqual([
        { kind: 'appointment', id: 'a1', date: '2026-01-15T09:00:00.000Z', label: 'Corte de cabello', status: 'CONFIRMED', total: 80, currency: 'BOB' },
        { kind: 'order', id: 'o1', date: '2026-01-01T00:00:00.000Z', label: 'ORD-AAA', status: 'CONFIRMED', total: 100, currency: 'BOB' },
      ]);
    });

    it('falls back to a generic label when the appointment has no service snapshot', async () => {
      appointmentsService.list.mockResolvedValue([
        { id: 'a1', status: 'PENDING', total: 0, currency: 'BOB', startAt: '2026-01-15T09:00:00.000Z', services: [] },
      ]);
      const result = await service.listPurchases('c1');
      expect(result[0].label).toBe('Cita');
    });
  });

  describe('generateStorefrontLink', () => {
    it('rejects when the store is not PUBLISHED', async () => {
      prisma.client.ecommerceStore.findFirst.mockResolvedValue({ id: 's1', status: 'DRAFT' });
      await expect(service.generateStorefrontLink('c1')).rejects.toThrow(ValidationError);
    });

    it('rejects when no store exists yet', async () => {
      prisma.client.ecommerceStore.findFirst.mockResolvedValue(null);
      await expect(service.generateStorefrontLink('c1')).rejects.toThrow(ValidationError);
    });

    it('creates a new session (inheriting the open conversation/branch) when none exists yet', async () => {
      prisma.client.ecommerceStore.findFirst.mockResolvedValue({ id: 's1', slug: 'demo-store', status: 'PUBLISHED' });
      prisma.client.conversation.findFirst.mockResolvedValue({ id: 'conv1' });
      prisma.client.ecommerceStoreBranch.findFirst.mockResolvedValue({ branchId: 'b1' });
      prisma.client.commerceSession.findFirst.mockResolvedValue(null);
      prisma.client.commerceSession.create.mockResolvedValue({ id: 'sess1' });

      const result = await service.generateStorefrontLink('c1');

      expect(prisma.client.commerceSession.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          contactId: 'c1',
          conversationId: 'conv1',
          storeId: 's1',
          branchId: 'b1',
          publicToken: expect.any(String),
          publicTokenExpiresAt: expect.any(Date),
        }),
      });
      expect(result.url).toMatch(/^http:\/\/localhost:3000\/tienda\/demo-store\?s=[a-f0-9]{64}$/);
    });

    it('renews the token on an existing session instead of creating a duplicate', async () => {
      prisma.client.ecommerceStore.findFirst.mockResolvedValue({ id: 's1', slug: 'demo-store', status: 'PUBLISHED' });
      prisma.client.conversation.findFirst.mockResolvedValue(null);
      prisma.client.ecommerceStoreBranch.findFirst.mockResolvedValue(null);
      prisma.client.commerceSession.findFirst.mockResolvedValue({ id: 'sess1' });
      prisma.client.commerceSession.update.mockResolvedValue({ id: 'sess1' });

      await service.generateStorefrontLink('c1');

      expect(prisma.client.commerceSession.create).not.toHaveBeenCalled();
      expect(prisma.client.commerceSession.update).toHaveBeenCalledWith({
        where: { id: 'sess1' },
        data: { publicToken: expect.any(String), publicTokenExpiresAt: expect.any(Date) },
      });
    });
  });
});
