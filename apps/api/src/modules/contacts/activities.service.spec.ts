import { ActivitiesService } from './activities.service';
import { NotFoundError } from '@omniflow/utils';

describe('ActivitiesService', () => {
  let service: ActivitiesService;
  let prisma: any;
  let contactsService: any;

  beforeEach(() => {
    prisma = {
      client: {
        activity: {
          findMany: jest.fn(),
          findFirst: jest.fn(),
          create: jest.fn(),
          delete: jest.fn(),
        },
      },
    };
    contactsService = { findOne: jest.fn().mockResolvedValue({ id: 'ct1' }) };
    service = new ActivitiesService(prisma, contactsService);
  });

  it('orders the timeline by occurredAt desc', async () => {
    prisma.client.activity.findMany.mockResolvedValue([]);
    await service.list('ct1');
    expect(prisma.client.activity.findMany).toHaveBeenCalledWith({
      where: { contactId: 'ct1' },
      orderBy: { occurredAt: 'desc' },
    });
  });

  it('lets Prisma default occurredAt when not supplied', async () => {
    prisma.client.activity.create.mockResolvedValue({ id: 'a1' });
    await service.create('ct1', 'user-1', { type: 'CALL', subject: 'Follow-up' } as any);
    const callArgs = prisma.client.activity.create.mock.calls[0][0];
    expect(callArgs.data.occurredAt).toBeUndefined();
  });

  it('parses occurredAt into a Date when supplied', async () => {
    prisma.client.activity.create.mockResolvedValue({ id: 'a1' });
    await service.create('ct1', 'user-1', {
      type: 'CALL',
      subject: 'Follow-up',
      occurredAt: '2026-05-22T15:45:00.000Z',
    } as any);
    const callArgs = prisma.client.activity.create.mock.calls[0][0];
    expect(callArgs.data.occurredAt).toEqual(new Date('2026-05-22T15:45:00.000Z'));
  });

  it('throws NotFoundError when removing an activity from another contact', async () => {
    prisma.client.activity.findFirst.mockResolvedValue(null);
    await expect(service.remove('ct1', 'a1')).rejects.toThrow(NotFoundError);
  });
});
