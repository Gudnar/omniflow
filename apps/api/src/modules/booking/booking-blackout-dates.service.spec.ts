import { BookingBlackoutDatesService } from './booking-blackout-dates.service';
import { ConflictError, NotFoundError } from '@omniflow/utils';

describe('BookingBlackoutDatesService', () => {
  let service: BookingBlackoutDatesService;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      client: {
        bookingBlackoutDate: {
          findMany: jest.fn(),
          findUnique: jest.fn(),
          create: jest.fn(),
          delete: jest.fn(),
        },
      },
    };
    service = new BookingBlackoutDatesService(prisma);
  });

  describe('list', () => {
    it('lists blackout dates for a branch ordered by date', async () => {
      prisma.client.bookingBlackoutDate.findMany.mockResolvedValue([]);
      await service.list('b1');
      expect(prisma.client.bookingBlackoutDate.findMany).toHaveBeenCalledWith({
        where: { branchId: 'b1' },
        orderBy: { date: 'asc' },
      });
    });
  });

  describe('create', () => {
    it('rejects a date already marked as blackout for that branch', async () => {
      prisma.client.bookingBlackoutDate.findUnique.mockResolvedValue({ id: 'bo1' });
      await expect(service.create({ branchId: 'b1', date: '2026-01-05' } as any)).rejects.toThrow(ConflictError);
      expect(prisma.client.bookingBlackoutDate.create).not.toHaveBeenCalled();
    });

    it('creates a blackout date normalized from the ISO date string', async () => {
      prisma.client.bookingBlackoutDate.findUnique.mockResolvedValue(null);
      await service.create({ branchId: 'b1', date: '2026-01-05', reason: 'Feriado' } as any);
      expect(prisma.client.bookingBlackoutDate.create).toHaveBeenCalledWith({
        data: { branchId: 'b1', date: new Date('2026-01-05'), reason: 'Feriado' },
      });
    });
  });

  describe('remove', () => {
    it('throws NotFoundError when the blackout date does not exist', async () => {
      prisma.client.bookingBlackoutDate.findUnique.mockResolvedValue(null);
      await expect(service.remove('missing')).rejects.toThrow(NotFoundError);
    });

    it('deletes an existing blackout date', async () => {
      prisma.client.bookingBlackoutDate.findUnique.mockResolvedValue({ id: 'bo1' });
      await service.remove('bo1');
      expect(prisma.client.bookingBlackoutDate.delete).toHaveBeenCalledWith({ where: { id: 'bo1' } });
    });
  });
});
