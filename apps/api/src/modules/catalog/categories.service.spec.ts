import { CategoriesService } from './categories.service';
import { ConflictError, NotFoundError } from '@omniflow/utils';

describe('CategoriesService', () => {
  let service: CategoriesService;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      client: {
        category: { findMany: jest.fn(), findUnique: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn() },
      },
    };
    service = new CategoriesService(prisma);
  });

  it('lists categories ordered by sortOrder then name', async () => {
    prisma.client.category.findMany.mockResolvedValue([]);
    await service.list();
    expect(prisma.client.category.findMany).toHaveBeenCalledWith({
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  });

  it('throws NotFoundError when the category does not exist', async () => {
    prisma.client.category.findUnique.mockResolvedValue(null);
    await expect(service.findOne('x')).rejects.toThrow(NotFoundError);
  });

  it('maps a duplicate slug on create to ConflictError', async () => {
    prisma.client.category.create.mockRejectedValue({ code: 'P2002' });
    await expect(service.create({ name: 'A', slug: 'a' } as any)).rejects.toThrow(ConflictError);
  });

  it('maps a duplicate slug on update to ConflictError', async () => {
    prisma.client.category.findUnique.mockResolvedValue({ id: 'c1' });
    prisma.client.category.update.mockRejectedValue({ code: 'P2002' });
    await expect(service.update('c1', { slug: 'dup' } as any)).rejects.toThrow(ConflictError);
  });

  it('removes an existing category', async () => {
    prisma.client.category.findUnique.mockResolvedValue({ id: 'c1' });
    const result = await service.remove('c1');
    expect(prisma.client.category.delete).toHaveBeenCalledWith({ where: { id: 'c1' } });
    expect(result).toEqual({ success: true });
  });
});
