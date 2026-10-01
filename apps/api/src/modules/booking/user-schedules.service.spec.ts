import { UserSchedulesService } from './user-schedules.service';
import { NotFoundError } from '@omniflow/utils';

describe('UserSchedulesService', () => {
  let service: UserSchedulesService;
  let prisma: any;
  let tx: any;

  beforeEach(() => {
    tx = {
      userSchedule: { update: jest.fn() },
      userScheduleInterval: { deleteMany: jest.fn(), createMany: jest.fn() },
    };
    prisma = {
      client: {
        userSchedule: { findFirst: jest.fn(), create: jest.fn() },
        userTimeOff: { findMany: jest.fn(), create: jest.fn(), findFirst: jest.fn(), delete: jest.fn() },
        $transaction: jest.fn((cb: any) => cb(tx)),
      },
    };
    service = new UserSchedulesService(prisma);
  });

  describe('getOrCreate', () => {
    it('returns the existing ACTIVE schedule when one exists', async () => {
      prisma.client.userSchedule.findFirst.mockResolvedValue({ id: 'us1', userId: 'u1', intervals: [] });
      const result = await service.getOrCreate('u1');
      expect(result.id).toBe('us1');
      expect(prisma.client.userSchedule.create).not.toHaveBeenCalled();
    });

    it('lazily creates a default schedule when none exists', async () => {
      prisma.client.userSchedule.findFirst.mockResolvedValue(null);
      prisma.client.userSchedule.create.mockResolvedValue({ id: 'us1', userId: 'u1', intervals: [] });
      await service.getOrCreate('u1');
      expect(prisma.client.userSchedule.create).toHaveBeenCalledWith({
        data: { userId: 'u1', name: 'Horario regular' },
        include: { intervals: true },
      });
    });
  });

  describe('updateIntervals', () => {
    it('replaces the full interval set inside a transaction', async () => {
      prisma.client.userSchedule.findFirst.mockResolvedValue({ id: 'us1', userId: 'u1', intervals: [] });

      await service.updateIntervals('u1', {
        intervals: [{ dayOfWeek: 1, startMinute: 540, endMinute: 1080 }],
      } as any);

      expect(tx.userScheduleInterval.deleteMany).toHaveBeenCalledWith({ where: { userScheduleId: 'us1' } });
      expect(tx.userScheduleInterval.createMany).toHaveBeenCalledWith({
        data: [{ userScheduleId: 'us1', dayOfWeek: 1, startMinute: 540, endMinute: 1080 }],
      });
    });

    it('clears intervals without recreating when given an empty array', async () => {
      prisma.client.userSchedule.findFirst.mockResolvedValue({ id: 'us1', userId: 'u1', intervals: [] });
      await service.updateIntervals('u1', { intervals: [] } as any);
      expect(tx.userScheduleInterval.createMany).not.toHaveBeenCalled();
    });
  });

  describe('addTimeOff', () => {
    it('creates a time-off entry with parsed dates', async () => {
      prisma.client.userTimeOff.create.mockResolvedValue({ id: 't1' });
      await service.addTimeOff('u1', { startAt: '2026-01-01T00:00:00.000Z', endAt: '2026-01-05T00:00:00.000Z' } as any);
      expect(prisma.client.userTimeOff.create).toHaveBeenCalledWith({
        data: { userId: 'u1', startAt: new Date('2026-01-01T00:00:00.000Z'), endAt: new Date('2026-01-05T00:00:00.000Z'), reason: undefined },
      });
    });
  });

  describe('removeTimeOff', () => {
    it('throws NotFoundError when the entry does not belong to the user', async () => {
      prisma.client.userTimeOff.findFirst.mockResolvedValue(null);
      await expect(service.removeTimeOff('u1', 't1')).rejects.toThrow(NotFoundError);
    });
  });
});
