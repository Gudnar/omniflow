import { BookingServicesService } from './booking-services.service';
import { ConflictError, NotFoundError } from '@omniflow/utils';

describe('BookingServicesService', () => {
  let service: BookingServicesService;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      client: {
        bookingService: { findMany: jest.fn(), findUnique: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn() },
        bookingServiceUser: { create: jest.fn(), deleteMany: jest.fn() },
      },
    };
    service = new BookingServicesService(prisma);
  });

  describe('findOne', () => {
    it('throws NotFoundError when missing', async () => {
      prisma.client.bookingService.findUnique.mockResolvedValue(null);
      await expect(service.findOne('s1')).rejects.toThrow(NotFoundError);
    });

    it('serializes the Decimal price to a plain number', async () => {
      prisma.client.bookingService.findUnique.mockResolvedValue({ id: 's1', price: '99.90' });
      const result = await service.findOne('s1');
      expect(result.price).toBe(99.9);
    });
  });

  describe('create', () => {
    it('maps a duplicate slug to ConflictError', async () => {
      prisma.client.bookingService.create.mockRejectedValue({ code: 'P2002' });
      await expect(service.create({ name: 'A', slug: 'a', durationMinutes: 30, price: 10 } as any)).rejects.toThrow(
        ConflictError,
      );
    });
  });

  describe('addQualifiedStaff', () => {
    it('maps a duplicate qualification to ConflictError', async () => {
      prisma.client.bookingService.findUnique.mockResolvedValue({ id: 's1', price: '10' });
      prisma.client.bookingServiceUser.create.mockRejectedValue({ code: 'P2002' });
      await expect(service.addQualifiedStaff('s1', 'u1')).rejects.toThrow(ConflictError);
    });

    it('adds a qualified user and returns the refreshed service', async () => {
      prisma.client.bookingService.findUnique.mockResolvedValue({ id: 's1', price: '10' });
      await service.addQualifiedStaff('s1', 'u1');
      expect(prisma.client.bookingServiceUser.create).toHaveBeenCalledWith({ data: { serviceId: 's1', userId: 'u1' } });
    });
  });

  describe('removeQualifiedStaff', () => {
    it('deletes via deleteMany (composite key)', async () => {
      prisma.client.bookingService.findUnique.mockResolvedValue({ id: 's1', price: '10' });
      await service.removeQualifiedStaff('s1', 'u1');
      expect(prisma.client.bookingServiceUser.deleteMany).toHaveBeenCalledWith({ where: { serviceId: 's1', userId: 'u1' } });
    });
  });

  describe('remove', () => {
    it('deletes an existing service', async () => {
      prisma.client.bookingService.findUnique.mockResolvedValue({ id: 's1', price: '10' });
      const result = await service.remove('s1');
      expect(prisma.client.bookingService.delete).toHaveBeenCalledWith({ where: { id: 's1' } });
      expect(result).toEqual({ success: true });
    });
  });
});
