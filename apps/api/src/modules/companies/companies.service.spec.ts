import { CompaniesService } from './companies.service';
import { NotFoundError } from '@omniflow/utils';

describe('CompaniesService', () => {
  let service: CompaniesService;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      client: {
        company: {
          findMany: jest.fn(),
          findUnique: jest.fn(),
          create: jest.fn(),
          update: jest.fn(),
          delete: jest.fn(),
        },
      },
    };
    service = new CompaniesService(prisma);
  });

  it('lists companies scoped by tenantId, ordered by name', async () => {
    prisma.client.company.findMany.mockResolvedValue([]);
    await service.list('tenant-1');
    expect(prisma.client.company.findMany).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-1' },
      orderBy: { name: 'asc' },
    });
  });

  it('throws NotFoundError when the company does not exist', async () => {
    prisma.client.company.findUnique.mockResolvedValue(null);
    await expect(service.findOne('missing')).rejects.toThrow(NotFoundError);
  });

  it('creates a company from the dto as-is', async () => {
    const dto = { name: 'Tech Solutions S.R.L.' };
    prisma.client.company.create.mockResolvedValue({ id: 'c1', ...dto });
    await service.create(dto as any);
    expect(prisma.client.company.create).toHaveBeenCalledWith({ data: dto });
  });

  it('checks existence before updating', async () => {
    prisma.client.company.findUnique.mockResolvedValue({ id: 'c1' });
    prisma.client.company.update.mockResolvedValue({ id: 'c1', name: 'New' });
    await service.update('c1', { name: 'New' });
    expect(prisma.client.company.update).toHaveBeenCalledWith({
      where: { id: 'c1' },
      data: { name: 'New' },
    });
  });

  it('checks existence before removing and returns a success flag', async () => {
    prisma.client.company.findUnique.mockResolvedValue({ id: 'c1' });
    prisma.client.company.delete.mockResolvedValue({ id: 'c1' });
    await expect(service.remove('c1')).resolves.toEqual({ success: true });
    expect(prisma.client.company.delete).toHaveBeenCalledWith({ where: { id: 'c1' } });
  });

  it('throws NotFoundError when removing a missing company', async () => {
    prisma.client.company.findUnique.mockResolvedValue(null);
    await expect(service.remove('missing')).rejects.toThrow(NotFoundError);
    expect(prisma.client.company.delete).not.toHaveBeenCalled();
  });
});
