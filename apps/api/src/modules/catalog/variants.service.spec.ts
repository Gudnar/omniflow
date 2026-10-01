import { VariantsService } from './variants.service';
import { ConflictError, NotFoundError, ValidationError } from '@omniflow/utils';

describe('VariantsService', () => {
  let service: VariantsService;
  let prisma: any;
  let productsService: any;

  beforeEach(() => {
    prisma = {
      client: {
        productVariant: { create: jest.fn(), findFirst: jest.fn(), update: jest.fn(), delete: jest.fn(), count: jest.fn() },
      },
    };
    productsService = { findOne: jest.fn().mockResolvedValue({ id: 'p1' }) };
    service = new VariantsService(prisma, productsService);
  });

  describe('create', () => {
    it('verifies the product exists before creating', async () => {
      prisma.client.productVariant.create.mockResolvedValue({ id: 'v1' });
      await service.create('p1', { sku: 'SKU-1' } as any);
      expect(productsService.findOne).toHaveBeenCalledWith('p1');
    });

    it('maps a duplicate SKU to ConflictError', async () => {
      prisma.client.productVariant.create.mockRejectedValue({ code: 'P2002' });
      await expect(service.create('p1', { sku: 'DUP' } as any)).rejects.toThrow(ConflictError);
    });
  });

  describe('update', () => {
    it('throws NotFoundError when the variant does not belong to the product', async () => {
      prisma.client.productVariant.findFirst.mockResolvedValue(null);
      await expect(service.update('p1', 'v1', {} as any)).rejects.toThrow(NotFoundError);
    });
  });

  describe('remove', () => {
    it('refuses to delete the last remaining variant of a product', async () => {
      prisma.client.productVariant.findFirst.mockResolvedValue({ id: 'v1', productId: 'p1' });
      prisma.client.productVariant.count.mockResolvedValue(1);

      await expect(service.remove('p1', 'v1')).rejects.toThrow(ValidationError);
      expect(prisma.client.productVariant.delete).not.toHaveBeenCalled();
    });

    it('deletes a variant when siblings remain', async () => {
      prisma.client.productVariant.findFirst.mockResolvedValue({ id: 'v1', productId: 'p1' });
      prisma.client.productVariant.count.mockResolvedValue(2);

      const result = await service.remove('p1', 'v1');

      expect(prisma.client.productVariant.delete).toHaveBeenCalledWith({ where: { id: 'v1' } });
      expect(result).toEqual({ success: true });
    });
  });
});
