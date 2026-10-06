import { BookingResourcesService } from './booking-resources.service';
import { ConflictError, NotFoundError, ValidationError } from '@omniflow/utils';

describe('BookingResourcesService', () => {
  let service: BookingResourcesService;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      client: {
        bookingResource: { findMany: jest.fn(), findUnique: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn() },
        bookingServiceUser: { findFirst: jest.fn(), create: jest.fn() },
        bookingResourceService: { create: jest.fn(), deleteMany: jest.fn() },
        bookingResourceSchedule: { create: jest.fn(), findFirst: jest.fn(), update: jest.fn(), delete: jest.fn() },
      },
    };
    service = new BookingResourcesService(prisma);
  });

  describe('create', () => {
    it('rejects a userId on a non-STAFF resource', async () => {
      await expect(
        service.create({ branchId: 'b1', name: 'Sala 1', type: 'ROOM', userId: 'u1' } as any),
      ).rejects.toThrow(ValidationError);
    });

    it('creates a STAFF resource with a userId', async () => {
      prisma.client.bookingResource.create.mockResolvedValue({ id: 'r1' });
      prisma.client.bookingResource.findUnique.mockResolvedValue({ id: 'r1', type: 'STAFF', userId: 'u1' });
      await service.create({ branchId: 'b1', name: 'Ana', type: 'STAFF', userId: 'u1' } as any);
      expect(prisma.client.bookingResource.create).toHaveBeenCalledWith({
        data: { branchId: 'b1', name: 'Ana', type: 'STAFF', userId: 'u1' },
      });
    });
  });

  describe('findOne', () => {
    it('throws NotFoundError when missing', async () => {
      prisma.client.bookingResource.findUnique.mockResolvedValue(null);
      await expect(service.findOne('r1')).rejects.toThrow(NotFoundError);
    });
  });

  describe('assignService', () => {
    it('auto-creates the qualification when a STAFF resource user lacks it, then assigns', async () => {
      prisma.client.bookingResource.findUnique.mockResolvedValue({ id: 'r1', type: 'STAFF', userId: 'u1' });
      prisma.client.bookingServiceUser.findFirst.mockResolvedValue(null);
      await service.assignService('r1', 's1');
      expect(prisma.client.bookingServiceUser.create).toHaveBeenCalledWith({ data: { serviceId: 's1', userId: 'u1' } });
      expect(prisma.client.bookingResourceService.create).toHaveBeenCalledWith({ data: { resourceId: 'r1', serviceId: 's1' } });
    });

    it('skips re-creating the qualification when the STAFF resource user is already qualified', async () => {
      prisma.client.bookingResource.findUnique.mockResolvedValue({ id: 'r1', type: 'STAFF', userId: 'u1' });
      prisma.client.bookingServiceUser.findFirst.mockResolvedValue({ serviceId: 's1', userId: 'u1' });
      await service.assignService('r1', 's1');
      expect(prisma.client.bookingServiceUser.create).not.toHaveBeenCalled();
      expect(prisma.client.bookingResourceService.create).toHaveBeenCalledWith({ data: { resourceId: 'r1', serviceId: 's1' } });
    });

    it('skips the qualification check for non-STAFF resources', async () => {
      prisma.client.bookingResource.findUnique.mockResolvedValue({ id: 'r1', type: 'ROOM', userId: null });
      await service.assignService('r1', 's1');
      expect(prisma.client.bookingServiceUser.findFirst).not.toHaveBeenCalled();
      expect(prisma.client.bookingResourceService.create).toHaveBeenCalled();
    });

    it('maps a duplicate assignment to ConflictError', async () => {
      prisma.client.bookingResource.findUnique.mockResolvedValue({ id: 'r1', type: 'ROOM', userId: null });
      prisma.client.bookingResourceService.create.mockRejectedValue({ code: 'P2002' });
      await expect(service.assignService('r1', 's1')).rejects.toThrow(ConflictError);
    });
  });

  describe('addScheduleEntry', () => {
    it('rejects when endMinute is not after startMinute', async () => {
      prisma.client.bookingResource.findUnique.mockResolvedValue({ id: 'r1', type: 'ROOM' });
      await expect(
        service.addScheduleEntry('r1', { dayOfWeek: 1, startMinute: 600, endMinute: 500 } as any),
      ).rejects.toThrow(ValidationError);
    });

    it('creates a valid schedule entry', async () => {
      prisma.client.bookingResource.findUnique.mockResolvedValue({ id: 'r1', type: 'ROOM' });
      await service.addScheduleEntry('r1', { dayOfWeek: 1, startMinute: 540, endMinute: 1080 } as any);
      expect(prisma.client.bookingResourceSchedule.create).toHaveBeenCalledWith({
        data: { resourceId: 'r1', dayOfWeek: 1, startMinute: 540, endMinute: 1080 },
      });
    });
  });

  describe('updateScheduleEntry', () => {
    it('throws NotFoundError when the entry does not belong to the resource', async () => {
      prisma.client.bookingResourceSchedule.findFirst.mockResolvedValue(null);
      await expect(service.updateScheduleEntry('r1', 'e1', { startMinute: 600 } as any)).rejects.toThrow(NotFoundError);
    });

    it('rejects when the resulting endMinute is not after the resulting startMinute', async () => {
      prisma.client.bookingResourceSchedule.findFirst.mockResolvedValue({ id: 'e1', resourceId: 'r1', dayOfWeek: 1, startMinute: 540, endMinute: 1080 });
      await expect(service.updateScheduleEntry('r1', 'e1', { startMinute: 1100 } as any)).rejects.toThrow(ValidationError);
      expect(prisma.client.bookingResourceSchedule.update).not.toHaveBeenCalled();
    });

    it('applies a partial update, falling back to the existing start/end when only one is given', async () => {
      prisma.client.bookingResourceSchedule.findFirst.mockResolvedValue({ id: 'e1', resourceId: 'r1', dayOfWeek: 1, startMinute: 540, endMinute: 1080 });
      prisma.client.bookingResource.findUnique.mockResolvedValue({ id: 'r1', type: 'ROOM' });

      await service.updateScheduleEntry('r1', 'e1', { dayOfWeek: 2 } as any);

      expect(prisma.client.bookingResourceSchedule.update).toHaveBeenCalledWith({
        where: { id: 'e1' },
        data: { dayOfWeek: 2 },
      });
    });
  });

  describe('removeScheduleEntry', () => {
    it('throws NotFoundError when the entry does not belong to the resource', async () => {
      prisma.client.bookingResourceSchedule.findFirst.mockResolvedValue(null);
      await expect(service.removeScheduleEntry('r1', 'e1')).rejects.toThrow(NotFoundError);
    });
  });
});
