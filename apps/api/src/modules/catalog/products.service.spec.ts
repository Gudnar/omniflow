import { ProductsService } from './products.service';
import { ConflictError, NotFoundError } from '@omniflow/utils';

describe('ProductsService', () => {
  let service: ProductsService;
  let prisma: any;
  let tx: any;

  beforeEach(() => {
    tx = {
      product: { create: jest.fn(), findUnique: jest.fn() },
      productVariant: { createMany: jest.fn() },
      branchProduct: { createMany: jest.fn() },
    };
    prisma = {
      client: {
        product: { findMany: jest.fn(), findUnique: jest.fn(), update: jest.fn(), delete: jest.fn() },
        branch: { findMany: jest.fn() },
        branchProduct: { findMany: jest.fn(), createMany: jest.fn() },
        $transaction: jest.fn((cb: any) => cb(tx)),
      },
    };
    service = new ProductsService(prisma);
  });

  describe('findOne', () => {
    it('throws NotFoundError when missing', async () => {
      prisma.client.product.findUnique.mockResolvedValue(null);
      await expect(service.findOne('p1')).rejects.toThrow(NotFoundError);
    });
  });

  describe('create', () => {
    it('creates one implicit default variant (using the slug as SKU) when none are given', async () => {
      tx.product.create.mockResolvedValue({ id: 'p1' });
      tx.product.findUnique.mockResolvedValue({ id: 'p1', variants: [] });

      await service.create({ name: 'Camiseta', slug: 'camiseta' } as any);

      expect(tx.productVariant.createMany).toHaveBeenCalledWith({
        data: [{ productId: 'p1', name: undefined, sku: 'camiseta', attributes: {}, sortOrder: 0 }],
      });
    });

    it('creates the explicit variants given, in order', async () => {
      tx.product.create.mockResolvedValue({ id: 'p1' });
      tx.product.findUnique.mockResolvedValue({ id: 'p1' });

      await service.create({
        name: 'Camiseta',
        slug: 'camiseta',
        variants: [
          { name: 'S', sku: 'CAM-S' },
          { name: 'M', sku: 'CAM-M' },
        ],
      } as any);

      expect(tx.productVariant.createMany).toHaveBeenCalledWith({
        data: [
          { productId: 'p1', name: 'S', sku: 'CAM-S', attributes: {}, sortOrder: 0 },
          { productId: 'p1', name: 'M', sku: 'CAM-M', attributes: {}, sortOrder: 1 },
        ],
      });
    });

    it('maps a duplicate SKU error to ConflictError with field=sku', async () => {
      tx.product.create.mockResolvedValue({ id: 'p1' });
      tx.productVariant.createMany.mockRejectedValue({ code: 'P2002', meta: { target: ['sku'] } });
      prisma.client.$transaction.mockRejectedValue(Object.assign(new Error(), { code: 'P2002', meta: { target: ['sku'] } }));

      await expect(service.create({ name: 'X', slug: 'x' } as any)).rejects.toThrow(ConflictError);
    });
  });

  describe('update', () => {
    it('throws NotFoundError before attempting the update when missing', async () => {
      prisma.client.product.findUnique.mockResolvedValue(null);
      await expect(service.update('missing', {} as any)).rejects.toThrow(NotFoundError);
      expect(prisma.client.product.update).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('deletes an existing product', async () => {
      prisma.client.product.findUnique.mockResolvedValue({ id: 'p1' });
      const result = await service.remove('p1');
      expect(prisma.client.product.delete).toHaveBeenCalledWith({ where: { id: 'p1' } });
      expect(result).toEqual({ success: true });
    });
  });

  describe('getBranchProducts', () => {
    it('lazily provisions missing (branch x variant) rows before returning the grid', async () => {
      prisma.client.product.findUnique.mockResolvedValue({
        id: 'p1',
        variants: [{ id: 'v1' }, { id: 'v2' }],
      });
      prisma.client.branch.findMany.mockResolvedValue([{ id: 'b1' }, { id: 'b2' }]);
      prisma.client.branchProduct.findMany
        .mockResolvedValueOnce([{ branchId: 'b1', variantId: 'v1' }]) // existing
        .mockResolvedValueOnce([]); // final grid fetch (return value unused in this assertion)

      await service.getBranchProducts('t1', 'p1');

      expect(prisma.client.branchProduct.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          { tenantId: 't1', branchId: 'b1', productId: 'p1', variantId: 'v2', price: 0 },
          { tenantId: 't1', branchId: 'b2', productId: 'p1', variantId: 'v1', price: 0 },
          { tenantId: 't1', branchId: 'b2', productId: 'p1', variantId: 'v2', price: 0 },
        ]),
      });
      expect(prisma.client.branchProduct.createMany.mock.calls[0][0].data).toHaveLength(3);
    });

    it('skips createMany entirely when every combination already exists', async () => {
      prisma.client.product.findUnique.mockResolvedValue({ id: 'p1', variants: [{ id: 'v1' }] });
      prisma.client.branch.findMany.mockResolvedValue([{ id: 'b1' }]);
      prisma.client.branchProduct.findMany
        .mockResolvedValueOnce([{ branchId: 'b1', variantId: 'v1' }])
        .mockResolvedValueOnce([{ id: 'bp1', branchId: 'b1', variantId: 'v1', price: '10.00', compareAtPrice: null }]);

      const result = await service.getBranchProducts('t1', 'p1');

      expect(prisma.client.branchProduct.createMany).not.toHaveBeenCalled();
      expect(result[0].price).toBe(10);
    });
  });
});
