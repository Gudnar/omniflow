import { BookingStorefrontService } from './booking-storefront.service';
import { ValidationError } from '@omniflow/utils';

describe('BookingStorefrontService', () => {
  let service: BookingStorefrontService;
  let prisma: any;
  let storefrontService: any;
  let appointmentsService: any;
  let bookingServicesService: any;

  const session = { id: 's1', tenantId: 't1', contactId: 'c1', branchId: 'b1' };

  beforeEach(() => {
    prisma = {
      client: {
        branch: { findUnique: jest.fn().mockResolvedValue({ id: 'b1', minBookingLeadDays: 1 }) },
        bookingBlackoutDate: { findMany: jest.fn().mockResolvedValue([]) },
      },
    };
    storefrontService = {
      resolveStoreBySlug: jest.fn().mockResolvedValue({ id: 'store1', tenantId: 't1' }),
      resolveSessionByToken: jest.fn().mockResolvedValue(session),
    };
    appointmentsService = {
      getAvailability: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockResolvedValue({ id: 'a1' }),
    };
    bookingServicesService = {
      list: jest.fn().mockResolvedValue([
        { id: 'svc-active', status: 'ACTIVE' },
        { id: 'svc-inactive', status: 'INACTIVE' },
      ]),
    };
    service = new BookingStorefrontService(prisma, storefrontService, appointmentsService, bookingServicesService);
  });

  describe('listServices', () => {
    it('resolves the store by slug and returns only ACTIVE services', async () => {
      const result = await service.listServices('demo');
      expect(storefrontService.resolveStoreBySlug).toHaveBeenCalledWith('demo');
      expect(result).toEqual([{ id: 'svc-active', status: 'ACTIVE' }]);
    });
  });

  describe('getAvailability', () => {
    it('rejects a session with no branch selected', async () => {
      storefrontService.resolveSessionByToken.mockResolvedValue({ ...session, branchId: null });
      await expect(service.getAvailability('tok', { serviceId: 'svc1', date: '2099-01-01' } as any)).rejects.toThrow(
        ValidationError,
      );
    });

    it('returns an empty list without querying availability when the date is before the lead-time window', async () => {
      const today = new Date().toISOString().slice(0, 10);
      const result = await service.getAvailability('tok', { serviceId: 'svc1', date: today } as any);
      expect(result).toEqual([]);
      expect(appointmentsService.getAvailability).not.toHaveBeenCalled();
    });

    it('delegates to AppointmentsService.getAvailability with the session branchId once the lead time is satisfied', async () => {
      const farFuture = '2099-06-15';
      await service.getAvailability('tok', { serviceId: 'svc1', date: farFuture } as any);
      expect(appointmentsService.getAvailability).toHaveBeenCalledWith({ serviceId: 'svc1', branchId: 'b1', date: farFuture });
    });
  });

  describe('listBlackoutDates', () => {
    it('bundles minBookingLeadDays with the branch dates as plain YYYY-MM-DD strings', async () => {
      prisma.client.bookingBlackoutDate.findMany.mockResolvedValue([{ date: new Date('2026-01-01') }]);
      const result = await service.listBlackoutDates('tok');
      expect(prisma.client.bookingBlackoutDate.findMany).toHaveBeenCalledWith({
        where: { branchId: 'b1' },
        orderBy: { date: 'asc' },
      });
      expect(result).toEqual({ minBookingLeadDays: 1, dates: ['2026-01-01'] });
    });
  });

  describe('bookAppointment', () => {
    it('rejects booking for a date before the branch minBookingLeadDays', async () => {
      const today = new Date().toISOString().slice(0, 10);
      await expect(
        service.bookAppointment('tok', { serviceId: 'svc1', startAt: `${today}T09:00:00.000Z` } as any),
      ).rejects.toThrow(ValidationError);
      expect(appointmentsService.create).not.toHaveBeenCalled();
    });

    it('creates the appointment with contactId/branchId resolved from the session, never from client input', async () => {
      await service.bookAppointment('tok', { serviceId: 'svc1', startAt: '2099-06-15T09:00:00.000Z' } as any);
      expect(appointmentsService.create).toHaveBeenCalledWith({
        contactId: 'c1',
        branchId: 'b1',
        serviceIds: ['svc1'],
        startAt: '2099-06-15T09:00:00.000Z',
      });
    });
  });
});
