import { InventoryTransfersService } from './inventory-transfers.service';
import { NotFoundError, ValidationError } from '@omniflow/utils';

describe('InventoryTransfersService', () => {
  let service: InventoryTransfersService;
  let prisma: any;
  let tx: any;

  beforeEach(() => {
    tx = {
      inventoryTransfer: { create: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
      inventoryTransferItem: { createMany: jest.fn() },
      branchProduct: { findUnique: jest.fn(), update: jest.fn(), create: jest.fn() },
      inventoryMovement: { create: jest.fn() },
    };
    prisma = {
      client: {
        inventoryTransfer: { findMany: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
        branch: { findMany: jest.fn() },
        $transaction: jest.fn((cb: any) => cb(tx)),
      },
    };
    service = new InventoryTransfersService(prisma);
  });

  describe('create', () => {
    it('rejects when fromBranchId equals toBranchId', async () => {
      await expect(
        service.create('t1', 'u1', { fromBranchId: 'b1', toBranchId: 'b1', items: [] } as any),
      ).rejects.toThrow(ValidationError);
    });

    it('rejects when either branch does not belong to the tenant', async () => {
      prisma.client.branch.findMany.mockResolvedValue([{ id: 'b1' }]); // only one found, not two

      await expect(
        service.create('t1', 'u1', { fromBranchId: 'b1', toBranchId: 'b2', items: [] } as any),
      ).rejects.toThrow(ValidationError);
    });

    it('creates a PENDING transfer with its items inside a transaction', async () => {
      prisma.client.branch.findMany.mockResolvedValue([{ id: 'b1' }, { id: 'b2' }]);
      tx.inventoryTransfer.create.mockResolvedValue({ id: 'tr1' });
      tx.inventoryTransfer.findUnique.mockResolvedValue({ id: 'tr1', status: 'PENDING' });

      await service.create('t1', 'u1', {
        fromBranchId: 'b1',
        toBranchId: 'b2',
        items: [{ variantId: 'v1', quantity: 3 }],
      } as any);

      expect(tx.inventoryTransferItem.createMany).toHaveBeenCalledWith({
        data: [{ transferId: 'tr1', variantId: 'v1', quantity: 3 }],
      });
    });
  });

  describe('complete', () => {
    const transfer = {
      id: 'tr1',
      status: 'PENDING',
      fromBranchId: 'b1',
      toBranchId: 'b2',
      items: [{ variantId: 'v1', quantity: 5 }],
    };

    it('throws when the transfer is not PENDING', async () => {
      prisma.client.inventoryTransfer.findUnique.mockResolvedValue({ ...transfer, status: 'COMPLETED' });
      await expect(service.complete('t1', 'tr1')).rejects.toThrow(ValidationError);
    });

    it('rejects when the source branch has insufficient stock', async () => {
      prisma.client.inventoryTransfer.findUnique.mockResolvedValue(transfer);
      tx.branchProduct.findUnique.mockResolvedValueOnce({ id: 'bp-src', stock: 2, productId: 'p1', price: '10.00' });

      await expect(service.complete('t1', 'tr1')).rejects.toThrow(ValidationError);
    });

    it('moves stock, writes TRANSFER_OUT/TRANSFER_IN movements, and marks COMPLETED', async () => {
      prisma.client.inventoryTransfer.findUnique.mockResolvedValue(transfer);
      tx.branchProduct.findUnique
        .mockResolvedValueOnce({ id: 'bp-src', stock: 10, productId: 'p1', price: '10.00' }) // source lookup
        .mockResolvedValueOnce(null); // destination lookup -> lazily create
      tx.branchProduct.create.mockResolvedValue({ id: 'bp-dst', stock: 0 });
      tx.inventoryTransfer.update.mockResolvedValue({ ...transfer, status: 'COMPLETED' });

      await service.complete('t1', 'tr1');

      expect(tx.branchProduct.update).toHaveBeenCalledWith({ where: { id: 'bp-src' }, data: { stock: 5 } });
      expect(tx.branchProduct.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ branchId: 'b2', variantId: 'v1', productId: 'p1' }) }),
      );
      expect(tx.branchProduct.update).toHaveBeenCalledWith({ where: { id: 'bp-dst' }, data: { stock: 5 } });
      expect(tx.inventoryMovement.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ branchProductId: 'bp-src', type: 'TRANSFER_OUT', quantityChange: -5 }),
      });
      expect(tx.inventoryMovement.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ branchProductId: 'bp-dst', type: 'TRANSFER_IN', quantityChange: 5 }),
      });
      expect(tx.inventoryTransfer.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'tr1' }, data: expect.objectContaining({ status: 'COMPLETED' }) }),
      );
    });
  });

  describe('cancel', () => {
    it('throws when the transfer is not PENDING', async () => {
      prisma.client.inventoryTransfer.findUnique.mockResolvedValue({ id: 'tr1', status: 'COMPLETED' });
      await expect(service.cancel('tr1')).rejects.toThrow(ValidationError);
    });

    it('marks a PENDING transfer as CANCELLED without touching stock', async () => {
      prisma.client.inventoryTransfer.findUnique.mockResolvedValue({ id: 'tr1', status: 'PENDING' });
      prisma.client.inventoryTransfer.update.mockResolvedValue({ id: 'tr1', status: 'CANCELLED' });

      await service.cancel('tr1');

      expect(prisma.client.inventoryTransfer.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'tr1' }, data: { status: 'CANCELLED' } }),
      );
    });
  });
});
