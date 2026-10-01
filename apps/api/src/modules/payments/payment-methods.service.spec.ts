import { PaymentMethodsService } from './payment-methods.service';
import { NotFoundError } from '@omniflow/utils';

describe('PaymentMethodsService', () => {
  let service: PaymentMethodsService;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      client: {
        paymentMethod: {
          findMany: jest.fn(),
          findUnique: jest.fn(),
          create: jest.fn(),
          update: jest.fn(),
          delete: jest.fn(),
        },
      },
    };
    service = new PaymentMethodsService(prisma);
  });

  it('lists all payment methods ordered by sortOrder then createdAt', async () => {
    prisma.client.paymentMethod.findMany.mockResolvedValue([]);
    await service.list();
    expect(prisma.client.paymentMethod.findMany).toHaveBeenCalledWith({
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
  });

  it('lists only enabled payment methods for the public storefront', async () => {
    prisma.client.paymentMethod.findMany.mockResolvedValue([]);
    await service.listEnabled();
    expect(prisma.client.paymentMethod.findMany).toHaveBeenCalledWith({
      where: { enabled: true },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
  });

  it('creates a payment method', async () => {
    const dto = { type: 'QR' as const, label: 'QR Simple' };
    prisma.client.paymentMethod.create.mockResolvedValue({ id: 'p1', ...dto });
    await service.create(dto);
    expect(prisma.client.paymentMethod.create).toHaveBeenCalledWith({ data: dto });
  });

  it('throws NotFoundError when updating a missing payment method', async () => {
    prisma.client.paymentMethod.findUnique.mockResolvedValue(null);
    await expect(service.update('missing', { label: 'X' })).rejects.toThrow(NotFoundError);
  });

  it('updates an existing payment method', async () => {
    prisma.client.paymentMethod.findUnique.mockResolvedValue({ id: 'p1' });
    prisma.client.paymentMethod.update.mockResolvedValue({ id: 'p1', label: 'Nueva etiqueta' });
    await service.update('p1', { label: 'Nueva etiqueta' });
    expect(prisma.client.paymentMethod.update).toHaveBeenCalledWith({
      where: { id: 'p1' },
      data: { label: 'Nueva etiqueta' },
    });
  });

  it('removes a payment method after checking existence', async () => {
    prisma.client.paymentMethod.findUnique.mockResolvedValue({ id: 'p1' });
    prisma.client.paymentMethod.delete.mockResolvedValue({ id: 'p1' });
    await expect(service.remove('p1')).resolves.toEqual({ success: true });
  });

  describe('resolveQrDownload', () => {
    it('returns the image url and label for an enabled QR method with an image', async () => {
      prisma.client.paymentMethod.findUnique.mockResolvedValue({
        id: 'p1',
        type: 'QR',
        enabled: true,
        qrImageUrl: 'http://x/uploads/payment-methods/t1/qr.png',
        label: 'QR Banco',
      });

      const result = await service.resolveQrDownload('p1');

      expect(result).toEqual({ qrImageUrl: 'http://x/uploads/payment-methods/t1/qr.png', label: 'QR Banco' });
    });

    it('throws NotFoundError for a non-QR method', async () => {
      prisma.client.paymentMethod.findUnique.mockResolvedValue({ id: 'p1', type: 'CASH', enabled: true, qrImageUrl: null });
      await expect(service.resolveQrDownload('p1')).rejects.toThrow(NotFoundError);
    });

    it('throws NotFoundError for a disabled QR method', async () => {
      prisma.client.paymentMethod.findUnique.mockResolvedValue({
        id: 'p1',
        type: 'QR',
        enabled: false,
        qrImageUrl: 'http://x/uploads/payment-methods/t1/qr.png',
      });
      await expect(service.resolveQrDownload('p1')).rejects.toThrow(NotFoundError);
    });

    it('throws NotFoundError for a QR method with no image uploaded yet', async () => {
      prisma.client.paymentMethod.findUnique.mockResolvedValue({ id: 'p1', type: 'QR', enabled: true, qrImageUrl: null });
      await expect(service.resolveQrDownload('p1')).rejects.toThrow(NotFoundError);
    });
  });
});
