import { VehiclesService } from './vehicles.service';
import { NotFoundError, ValidationError } from '@omniflow/utils';

describe('VehiclesService', () => {
  let service: VehiclesService;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      client: {
        vehicle: { findMany: jest.fn(), findUnique: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn() },
        branch: { findUnique: jest.fn() },
      },
    };
    service = new VehiclesService(prisma);
  });

  describe('create', () => {
    it('rejects a branchId that does not belong to this tenant', async () => {
      prisma.client.branch.findUnique.mockResolvedValue(null);
      await expect(service.create('t1', { type: 'MOTORCYCLE', branchId: 'other' } as any)).rejects.toThrow(
        ValidationError,
      );
    });

    it('creates a vehicle with no branchId', async () => {
      prisma.client.vehicle.create.mockResolvedValue({ id: 'v1' });
      const result = await service.create('t1', { type: 'MOTORCYCLE' } as any);
      expect(result.id).toBe('v1');
    });
  });

  describe('update/delete', () => {
    it('throws NotFoundError updating a missing vehicle', async () => {
      prisma.client.vehicle.findUnique.mockResolvedValue(null);
      await expect(service.update('v1', {})).rejects.toThrow(NotFoundError);
    });

    it('throws NotFoundError deleting a missing vehicle', async () => {
      prisma.client.vehicle.findUnique.mockResolvedValue(null);
      await expect(service.delete('v1')).rejects.toThrow(NotFoundError);
    });
  });
});
