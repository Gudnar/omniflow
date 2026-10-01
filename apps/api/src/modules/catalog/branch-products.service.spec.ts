import { BranchProductsService } from './branch-products.service';
import { NotFoundError, ValidationError } from '@omniflow/utils';

describe('BranchProductsService', () => {
  let service: BranchProductsService;
  let prisma: any;
  let tx: any;

  beforeEach(() => {
    tx = {
      inventoryMovement: { create: jest.fn() },
      branchProduct: { update: jest.fn() },
    };
    prisma = {
      client: {
        branchProduct: { findUnique: jest.fn(), update: jest.fn() },
        inventoryMovement: { findMany: jest.fn() },
        $transaction: jest.fn((cb: any) => cb(tx)),
      },
    };
    service = new BranchProductsService(prisma);
  });

  describe('findOne', () => {
    it('throws NotFoundError when missing', async () => {
      prisma.client.branchProduct.findUnique.mockResolvedValue(null);
      await expect(service.findOne('bp1')).rejects.toThrow(NotFoundError);
    });
  });

  describe('update', () => {
    it('updates price/threshold/status fields and serializes the Decimal price', async () => {
      prisma.client.branchProduct.findUnique.mockResolvedValue({ id: 'bp1', stock: 5 });
      prisma.client.branchProduct.update.mockResolvedValue({ id: 'bp1', price: '19.99', compareAtPrice: null });

      const result = await service.update('bp1', { price: 19.99 } as any);

      expect(prisma.client.branchProduct.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'bp1' }, data: { price: 19.99 } }),
      );
      expect(result.price).toBe(19.99);
    });
  });

  describe('adjustStock', () => {
    it('creates a movement and increments stock inside one transaction', async () => {
      prisma.client.branchProduct.findUnique.mockResolvedValue({ id: 'bp1', stock: 10 });
      tx.branchProduct.update.mockResolvedValue({ id: 'bp1', stock: 15, price: '10.00', compareAtPrice: null });

      const result = await service.adjustStock('bp1', 'user-1', { type: 'RESTOCK', quantityChange: 5 } as any);

      expect(tx.inventoryMovement.create).toHaveBeenCalledWith({
        data: { branchProductId: 'bp1', type: 'RESTOCK', quantityChange: 5, note: undefined, createdByUserId: 'user-1' },
      });
      expect(tx.branchProduct.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'bp1' }, data: { stock: 15 } }),
      );
      expect(result.stock).toBe(15);
    });

    it('rejects an adjustment that would take stock negative, without starting a transaction', async () => {
      prisma.client.branchProduct.findUnique.mockResolvedValue({ id: 'bp1', stock: 3 });

      await expect(
        service.adjustStock('bp1', 'user-1', { type: 'ADJUSTMENT', quantityChange: -10 } as any),
      ).rejects.toThrow(ValidationError);
      expect(prisma.client.$transaction).not.toHaveBeenCalled();
    });
  });

  describe('listMovements', () => {
    it('returns movements newest first after confirming the branch product exists', async () => {
      prisma.client.branchProduct.findUnique.mockResolvedValue({ id: 'bp1' });
      prisma.client.inventoryMovement.findMany.mockResolvedValue([]);

      await service.listMovements('bp1');

      expect(prisma.client.inventoryMovement.findMany).toHaveBeenCalledWith({
        where: { branchProductId: 'bp1' },
        orderBy: { createdAt: 'desc' },
      });
    });
  });
});
