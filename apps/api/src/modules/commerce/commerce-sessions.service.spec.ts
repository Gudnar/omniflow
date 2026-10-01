import { CommerceSessionsService } from './commerce-sessions.service';
import { NotFoundError } from '@omniflow/utils';

describe('CommerceSessionsService', () => {
  let service: CommerceSessionsService;
  let prisma: any;
  let tx: any;

  beforeEach(() => {
    tx = { cart: { create: jest.fn() }, commerceSession: { update: jest.fn() } };
    prisma = {
      client: {
        ecommerceStore: { findUnique: jest.fn() },
        ecommerceStoreBranch: { findMany: jest.fn() },
        commerceSession: { create: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
        $transaction: jest.fn((cb: any) => cb(tx)),
      },
    };
    service = new CommerceSessionsService(prisma);
  });

  describe('create', () => {
    it('auto-fills storeId from the tenant EcommerceStore when one exists', async () => {
      prisma.client.ecommerceStore.findUnique.mockResolvedValue({ id: 'store-1' });
      prisma.client.commerceSession.create.mockResolvedValue({ id: 's1' });

      await service.create('t1', { contactId: 'c1' } as any);

      expect(prisma.client.commerceSession.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ contactId: 'c1', storeId: 'store-1' }),
      });
    });

    it('leaves storeId undefined when no store exists yet', async () => {
      prisma.client.ecommerceStore.findUnique.mockResolvedValue(null);
      prisma.client.commerceSession.create.mockResolvedValue({ id: 's1' });

      await service.create('t1', { contactId: 'c1' } as any);

      expect(prisma.client.commerceSession.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ storeId: undefined }),
      });
    });
  });

  describe('findOne', () => {
    it('throws NotFoundError when missing', async () => {
      prisma.client.commerceSession.findUnique.mockResolvedValue(null);
      await expect(service.findOne('s1')).rejects.toThrow(NotFoundError);
    });
  });

  describe('getOrCreateCart', () => {
    it('returns the existing ACTIVE cart (serialized) without creating a new one', async () => {
      prisma.client.commerceSession.findUnique.mockResolvedValue({
        id: 's1',
        carts: [
          {
            id: 'cart-1',
            status: 'ACTIVE',
            subtotal: '10',
            discount: '0',
            shipping: '0',
            tax: '0',
            total: '10',
            items: [],
          },
        ],
      });

      const result = await service.getOrCreateCart('s1');

      expect(result).toEqual(expect.objectContaining({ id: 'cart-1', status: 'ACTIVE', total: 10 }));
      expect(prisma.client.$transaction).not.toHaveBeenCalled();
    });

    it('creates a new cart inheriting branch/conversation when none is ACTIVE (including on a session whose prior cart already checked out)', async () => {
      prisma.client.commerceSession.findUnique.mockResolvedValue({
        id: 's1',
        contactId: 'c1',
        conversationId: 'conv1',
        branchId: 'b1',
        carts: [],
      });
      tx.cart.create.mockResolvedValue({ id: 'cart-2' });

      await service.getOrCreateCart('s1');

      expect(tx.cart.create).toHaveBeenCalledWith({
        data: { contactId: 'c1', commerceSessionId: 's1', conversationId: 'conv1', branchId: 'b1' },
        include: expect.objectContaining({ items: expect.objectContaining({ include: expect.objectContaining({ product: expect.anything(), variant: expect.anything() }) }) }),
      });
      expect(tx.commerceSession.update).toHaveBeenCalledWith({
        where: { id: 's1' },
        data: { cartId: 'cart-2' },
      });
    });
  });

  describe('setNearestBranch', () => {
    const laPaz = { id: 'b-lapaz', latitude: -16.5, longitude: -68.15 };
    const cochabamba = { id: 'b-ccba', latitude: -17.39, longitude: -66.16 };

    it('does nothing when the session already has an ACTIVE cart (never resyncs an in-progress purchase)', async () => {
      prisma.client.commerceSession.findUnique.mockResolvedValue({
        id: 's1',
        storeId: 'store-1',
        carts: [{ id: 'cart-1', status: 'ACTIVE', subtotal: '0', discount: '0', shipping: '0', tax: '0', total: '0', items: [] }],
      });

      await service.setNearestBranch('s1', { latitude: -16.5, longitude: -68.15 } as any);

      expect(prisma.client.ecommerceStoreBranch.findMany).not.toHaveBeenCalled();
      expect(prisma.client.commerceSession.update).not.toHaveBeenCalled();
    });

    it('does nothing when the session has no store yet', async () => {
      prisma.client.commerceSession.findUnique.mockResolvedValue({ id: 's1', storeId: null, carts: [] });

      await service.setNearestBranch('s1', { latitude: -16.5, longitude: -68.15 } as any);

      expect(prisma.client.ecommerceStoreBranch.findMany).not.toHaveBeenCalled();
    });

    it('does nothing when fewer than 2 linked branches have coordinates configured', async () => {
      prisma.client.commerceSession.findUnique.mockResolvedValue({ id: 's1', storeId: 'store-1', carts: [] });
      prisma.client.ecommerceStoreBranch.findMany.mockResolvedValue([
        { branch: laPaz },
        { branch: { id: 'b-none', latitude: null, longitude: null } },
      ]);

      await service.setNearestBranch('s1', { latitude: -16.5, longitude: -68.15 } as any);

      expect(prisma.client.commerceSession.update).not.toHaveBeenCalled();
    });

    it('assigns the branch closest to the given coordinates', async () => {
      prisma.client.commerceSession.findUnique
        .mockResolvedValueOnce({ id: 's1', storeId: 'store-1', carts: [] })
        .mockResolvedValueOnce({ id: 's1', storeId: 'store-1', branchId: 'b-lapaz', carts: [] });
      prisma.client.ecommerceStoreBranch.findMany.mockResolvedValue([{ branch: laPaz }, { branch: cochabamba }]);

      const result = await service.setNearestBranch('s1', { latitude: -16.51, longitude: -68.14 } as any);

      expect(prisma.client.commerceSession.update).toHaveBeenCalledWith({
        where: { id: 's1' },
        data: { branchId: 'b-lapaz' },
      });
      expect(result.branchId).toBe('b-lapaz');
    });

    it('picks the other branch when the customer is closer to it instead', async () => {
      prisma.client.commerceSession.findUnique
        .mockResolvedValueOnce({ id: 's1', storeId: 'store-1', carts: [] })
        .mockResolvedValueOnce({ id: 's1', storeId: 'store-1', branchId: 'b-ccba', carts: [] });
      prisma.client.ecommerceStoreBranch.findMany.mockResolvedValue([{ branch: laPaz }, { branch: cochabamba }]);

      await service.setNearestBranch('s1', { latitude: -17.4, longitude: -66.15 } as any);

      expect(prisma.client.commerceSession.update).toHaveBeenCalledWith({
        where: { id: 's1' },
        data: { branchId: 'b-ccba' },
      });
    });
  });

  describe('recordLocation', () => {
    it('merges location into existing session metadata', async () => {
      prisma.client.commerceSession.findUnique.mockResolvedValue({ id: 's1', metadata: { foo: 'bar' }, carts: [] });
      prisma.client.commerceSession.update.mockResolvedValue({ id: 's1' });

      await service.recordLocation('s1', { latitude: -16.5, longitude: -68.1 } as any);

      expect(prisma.client.commerceSession.update).toHaveBeenCalledWith({
        where: { id: 's1' },
        data: {
          metadata: { foo: 'bar', location: { latitude: -16.5, longitude: -68.1, address: undefined } },
        },
      });
    });
  });
});
