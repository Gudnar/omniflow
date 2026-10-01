import { SegmentsService } from './segments.service';
import { NotFoundError } from '@omniflow/utils';

describe('SegmentsService', () => {
  let service: SegmentsService;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      client: {
        segment: { findMany: jest.fn(), findUnique: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn() },
        contact: { findMany: jest.fn(), count: jest.fn() },
      },
    };
    service = new SegmentsService(prisma);
  });

  describe('findOne', () => {
    it('throws NotFoundError when missing', async () => {
      prisma.client.segment.findUnique.mockResolvedValue(null);
      await expect(service.findOne('missing')).rejects.toThrow(NotFoundError);
    });
  });

  describe('resolveContactIds', () => {
    it('builds an AND-of-fields where clause from the filterQuery', async () => {
      prisma.client.segment.findUnique.mockResolvedValue({
        id: 's1',
        filterQuery: { status: 'ACTIVE', type: 'CUSTOMER', tagIds: ['t1', 't2'] },
      });
      prisma.client.contact.findMany.mockResolvedValue([{ id: 'c1' }, { id: 'c2' }]);

      const ids = await service.resolveContactIds('s1');

      expect(prisma.client.contact.findMany).toHaveBeenCalledWith({
        where: {
          status: 'ACTIVE',
          type: 'CUSTOMER',
          tags: { some: { tagId: { in: ['t1', 't2'] } } },
        },
        select: { id: true },
      });
      expect(ids).toEqual(['c1', 'c2']);
    });

    it('omits absent filter fields entirely rather than passing them as undefined', async () => {
      prisma.client.segment.findUnique.mockResolvedValue({ id: 's1', filterQuery: {} });
      prisma.client.contact.findMany.mockResolvedValue([]);

      await service.resolveContactIds('s1');

      expect(prisma.client.contact.findMany).toHaveBeenCalledWith({ where: {}, select: { id: true } });
    });
  });

  describe('previewCount', () => {
    it('counts contacts matching the same filter used by resolveContactIds', async () => {
      prisma.client.segment.findUnique.mockResolvedValue({ id: 's1', filterQuery: { status: 'ACTIVE' } });
      prisma.client.contact.count.mockResolvedValue(42);

      const count = await service.previewCount('s1');

      expect(prisma.client.contact.count).toHaveBeenCalledWith({ where: { status: 'ACTIVE' } });
      expect(count).toBe(42);
    });
  });
});
