import { TagsService } from './tags.service';
import { ConflictError, NotFoundError } from '@omniflow/utils';

describe('TagsService', () => {
  let service: TagsService;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      client: {
        tag: {
          findMany: jest.fn(),
          findUnique: jest.fn(),
          create: jest.fn(),
          update: jest.fn(),
          delete: jest.fn(),
        },
      },
    };
    service = new TagsService(prisma);
  });

  it('lists tags scoped by tenantId, ordered by name', async () => {
    prisma.client.tag.findMany.mockResolvedValue([]);
    await service.list('tenant-1');
    expect(prisma.client.tag.findMany).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-1' },
      orderBy: { name: 'asc' },
    });
  });

  it('creates a tag', async () => {
    const dto = { name: 'VIP', color: '#f59e0b' };
    prisma.client.tag.create.mockResolvedValue({ id: 't1', ...dto });
    await service.create(dto);
    expect(prisma.client.tag.create).toHaveBeenCalledWith({ data: dto });
  });

  it('throws ConflictError when the tag name already exists for the tenant', async () => {
    prisma.client.tag.create.mockRejectedValue({ code: 'P2002' });
    await expect(service.create({ name: 'VIP' })).rejects.toThrow(ConflictError);
  });

  it('throws NotFoundError when updating a missing tag', async () => {
    prisma.client.tag.findUnique.mockResolvedValue(null);
    await expect(service.update('missing', { name: 'X' })).rejects.toThrow(NotFoundError);
  });

  it('throws ConflictError when renaming a tag to a name that already exists', async () => {
    prisma.client.tag.findUnique.mockResolvedValue({ id: 't1' });
    prisma.client.tag.update.mockRejectedValue({ code: 'P2002' });
    await expect(service.update('t1', { name: 'Duplicate' })).rejects.toThrow(ConflictError);
  });

  it('removes a tag after checking existence', async () => {
    prisma.client.tag.findUnique.mockResolvedValue({ id: 't1' });
    prisma.client.tag.delete.mockResolvedValue({ id: 't1' });
    await expect(service.remove('t1')).resolves.toEqual({ success: true });
  });
});
