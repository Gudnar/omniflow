import { BranchesService } from './branches.service';
import { NotFoundError } from '@omniflow/utils';

describe('BranchesService', () => {
  let service: BranchesService;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      client: {
        branch: {
          findMany: jest.fn(),
          findUnique: jest.fn(),
          create: jest.fn(),
          update: jest.fn(),
        },
      },
    };
    service = new BranchesService(prisma);
  });

  describe('list', () => {
    it('scopes the query by tenantId and orders by name', async () => {
      prisma.client.branch.findMany.mockResolvedValue([]);
      await service.list('tenant-1');
      expect(prisma.client.branch.findMany).toHaveBeenCalledWith({
        where: { tenantId: 'tenant-1' },
        orderBy: { name: 'asc' },
      });
    });
  });

  describe('findOne', () => {
    it('throws NotFoundError when the branch does not exist', async () => {
      prisma.client.branch.findUnique.mockResolvedValue(null);
      await expect(service.findOne('missing')).rejects.toThrow(NotFoundError);
    });

    it('returns the branch when found', async () => {
      const branch = { id: 'b1', name: 'Centro' };
      prisma.client.branch.findUnique.mockResolvedValue(branch);
      await expect(service.findOne('b1')).resolves.toEqual(branch);
    });
  });

  describe('create', () => {
    it('generates a slug from the name and does not set tenantId explicitly', async () => {
      prisma.client.branch.create.mockResolvedValue({ id: 'b1', slug: 'sucursal-centro' });
      await service.create({ name: 'Sucursal Centro' } as any);
      const callArgs = prisma.client.branch.create.mock.calls[0][0];
      expect(callArgs.data.slug).toBe('sucursal-centro');
      expect(callArgs.data.tenantId).toBeUndefined();
    });

    it('passes latitude/longitude through when provided', async () => {
      prisma.client.branch.create.mockResolvedValue({ id: 'b1' });
      await service.create({ name: 'Sucursal Centro', latitude: -16.5, longitude: -68.15 } as any);
      const callArgs = prisma.client.branch.create.mock.calls[0][0];
      expect(callArgs.data.latitude).toBe(-16.5);
      expect(callArgs.data.longitude).toBe(-68.15);
    });

    it('retries with a suffixed slug on a P2002 slug collision', async () => {
      const conflict = { code: 'P2002', meta: { target: ['slug'] } };
      prisma.client.branch.create
        .mockRejectedValueOnce(conflict)
        .mockResolvedValueOnce({ id: 'b1', slug: 'sucursal-centro-abc' });

      const result = await service.create({ name: 'Sucursal Centro' } as any);
      expect(prisma.client.branch.create).toHaveBeenCalledTimes(2);
      expect(result).toEqual({ id: 'b1', slug: 'sucursal-centro-abc' });
    });

    it('rethrows non-collision errors immediately', async () => {
      const error = new Error('unexpected');
      prisma.client.branch.create.mockRejectedValue(error);
      await expect(service.create({ name: 'X' } as any)).rejects.toThrow('unexpected');
      expect(prisma.client.branch.create).toHaveBeenCalledTimes(1);
    });
  });

  describe('update', () => {
    it('checks existence before updating', async () => {
      prisma.client.branch.findUnique.mockResolvedValue({ id: 'b1' });
      prisma.client.branch.update.mockResolvedValue({ id: 'b1', name: 'New Name' });

      await service.update('b1', { name: 'New Name' });

      expect(prisma.client.branch.findUnique).toHaveBeenCalledWith({ where: { id: 'b1' } });
      expect(prisma.client.branch.update).toHaveBeenCalledWith({
        where: { id: 'b1' },
        data: { name: 'New Name' },
      });
    });

    it('throws NotFoundError when updating a missing branch', async () => {
      prisma.client.branch.findUnique.mockResolvedValue(null);
      await expect(service.update('missing', { name: 'X' })).rejects.toThrow(NotFoundError);
      expect(prisma.client.branch.update).not.toHaveBeenCalled();
    });
  });

  describe('deactivate', () => {
    it('sets status to INACTIVE', async () => {
      prisma.client.branch.findUnique.mockResolvedValue({ id: 'b1' });
      prisma.client.branch.update.mockResolvedValue({ id: 'b1', status: 'INACTIVE' });

      await service.deactivate('b1');

      expect(prisma.client.branch.update).toHaveBeenCalledWith({
        where: { id: 'b1' },
        data: { status: 'INACTIVE' },
      });
    });
  });
});
