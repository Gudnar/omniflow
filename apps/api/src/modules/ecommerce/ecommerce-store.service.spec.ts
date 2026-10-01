import { EcommerceStoreService } from './ecommerce-store.service';
import { ValidationError } from '@omniflow/utils';

describe('EcommerceStoreService', () => {
  let service: EcommerceStoreService;
  let prisma: any;
  let tx: any;

  const rawStore = {
    id: 'store-1',
    tenantId: 't1',
    name: 'Mi tienda',
    slug: 'mi-tienda',
    status: 'DRAFT',
    settings: { storeId: 'store-1', primaryColor: '#2563eb' },
    sections: [],
    branches: [{ branchId: 'b1' }],
  };

  beforeEach(() => {
    tx = {
      ecommerceStore: { update: jest.fn() },
      ecommerceStoreBranch: { deleteMany: jest.fn(), createMany: jest.fn() },
    };
    prisma = {
      client: {
        ecommerceStore: {
          findUnique: jest.fn(),
          create: jest.fn(),
          update: jest.fn(),
        },
        tenant: { findUnique: jest.fn().mockResolvedValue({ id: 't1', name: 'Acme' }) },
        branch: { findMany: jest.fn() },
        $transaction: jest.fn((cb: any) => cb(tx)),
      },
    };
    service = new EcommerceStoreService(prisma);
  });

  describe('getOrCreate', () => {
    it('returns the existing store serialized with branchIds when one exists', async () => {
      prisma.client.ecommerceStore.findUnique.mockResolvedValue(rawStore);

      const result = await service.getOrCreate('t1');

      expect(result.branchIds).toEqual(['b1']);
      expect(result.branches).toBeUndefined();
      expect(prisma.client.ecommerceStore.create).not.toHaveBeenCalled();
    });

    it('lazily creates a default DRAFT store when none exists, seeding settings with tenantId', async () => {
      prisma.client.ecommerceStore.findUnique.mockResolvedValue(null);
      prisma.client.ecommerceStore.create.mockResolvedValue({ ...rawStore, branches: [] });

      await service.getOrCreate('t1');

      const callArgs = prisma.client.ecommerceStore.create.mock.calls[0][0];
      expect(callArgs.data.name).toBe('Acme');
      expect(callArgs.data.settings).toEqual({ create: { tenantId: 't1' } });
    });
  });

  describe('update', () => {
    beforeEach(() => {
      prisma.client.ecommerceStore.findUnique.mockResolvedValue(rawStore);
    });

    it('updates plain store fields inside a transaction', async () => {
      await service.update('t1', { name: 'Nueva tienda', operationMode: 'BOOKING' } as any);

      expect(tx.ecommerceStore.update).toHaveBeenCalledWith({
        where: { id: 'store-1' },
        data: { name: 'Nueva tienda', operationMode: 'BOOKING' },
      });
    });

    it('updates chatEnabled independently of other fields', async () => {
      await service.update('t1', { chatEnabled: true } as any);

      expect(tx.ecommerceStore.update).toHaveBeenCalledWith({
        where: { id: 'store-1' },
        data: { chatEnabled: true },
      });
    });

    it('rejects branchIds that do not belong to the tenant', async () => {
      prisma.client.branch.findMany.mockResolvedValue([{ id: 'b1' }]);

      await expect(
        service.update('t1', { branchIds: ['b1', 'b2-foreign'] } as any),
      ).rejects.toThrow(ValidationError);

      expect(prisma.client.$transaction).not.toHaveBeenCalled();
    });

    it('replaces the branch set when branchIds are all valid', async () => {
      prisma.client.branch.findMany.mockResolvedValue([{ id: 'b1' }, { id: 'b2' }]);

      await service.update('t1', { branchIds: ['b1', 'b2'] } as any);

      expect(tx.ecommerceStoreBranch.deleteMany).toHaveBeenCalledWith({ where: { storeId: 'store-1' } });
      expect(tx.ecommerceStoreBranch.createMany).toHaveBeenCalledWith({
        data: [
          { storeId: 'store-1', branchId: 'b1' },
          { storeId: 'store-1', branchId: 'b2' },
        ],
      });
    });

    it('clears the branch set without recreating when branchIds is an empty array', async () => {
      prisma.client.branch.findMany.mockResolvedValue([]);

      await service.update('t1', { branchIds: [] } as any);

      expect(tx.ecommerceStoreBranch.deleteMany).toHaveBeenCalledWith({ where: { storeId: 'store-1' } });
      expect(tx.ecommerceStoreBranch.createMany).not.toHaveBeenCalled();
    });
  });

  describe('publish', () => {
    it('sets status to PUBLISHED and stamps publishedAt', async () => {
      prisma.client.ecommerceStore.findUnique.mockResolvedValue(rawStore);

      await service.publish('t1');

      expect(prisma.client.ecommerceStore.update).toHaveBeenCalledWith({
        where: { id: 'store-1' },
        data: { status: 'PUBLISHED', publishedAt: expect.any(Date) },
      });
    });
  });

  describe('getPreview', () => {
    it('returns the same assembled shape as getOrCreate', async () => {
      prisma.client.ecommerceStore.findUnique.mockResolvedValue(rawStore);

      const result = await service.getPreview('t1');

      expect(result.id).toBe('store-1');
      expect(result.branchIds).toEqual(['b1']);
    });
  });
});
