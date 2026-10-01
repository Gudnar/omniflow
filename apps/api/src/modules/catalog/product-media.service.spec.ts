import { ProductMediaService } from './product-media.service';
import { NotFoundError } from '@omniflow/utils';

describe('ProductMediaService', () => {
  let service: ProductMediaService;
  let prisma: any;
  let productsService: any;

  beforeEach(() => {
    prisma = {
      client: {
        productMedia: { create: jest.fn(), updateMany: jest.fn(), update: jest.fn(), findFirst: jest.fn(), delete: jest.fn() },
      },
    };
    productsService = { findOne: jest.fn().mockResolvedValue({ id: 'p1' }) };
    service = new ProductMediaService(prisma, productsService);
  });

  describe('create', () => {
    it('unsets the previous primary image when creating a new primary one', async () => {
      prisma.client.productMedia.create.mockResolvedValue({ id: 'm1' });
      await service.create('p1', { url: 'https://x/a.png', isPrimary: true } as any);

      expect(prisma.client.productMedia.updateMany).toHaveBeenCalledWith({
        where: { productId: 'p1' },
        data: { isPrimary: false },
      });
    });

    it('does not touch other media when not marked primary', async () => {
      prisma.client.productMedia.create.mockResolvedValue({ id: 'm1' });
      await service.create('p1', { url: 'https://x/a.png' } as any);
      expect(prisma.client.productMedia.updateMany).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('throws NotFoundError when the media item does not belong to the product', async () => {
      prisma.client.productMedia.findFirst.mockResolvedValue(null);
      await expect(service.update('p1', 'm1', {} as any)).rejects.toThrow(NotFoundError);
    });
  });

  describe('remove', () => {
    it('deletes an existing media item', async () => {
      prisma.client.productMedia.findFirst.mockResolvedValue({ id: 'm1', productId: 'p1' });
      const result = await service.remove('p1', 'm1');
      expect(prisma.client.productMedia.delete).toHaveBeenCalledWith({ where: { id: 'm1' } });
      expect(result).toEqual({ success: true });
    });
  });
});
