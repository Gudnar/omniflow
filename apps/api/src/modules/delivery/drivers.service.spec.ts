import { DriversService } from './drivers.service';
import { NotFoundError, ValidationError } from '@omniflow/utils';

describe('DriversService', () => {
  let service: DriversService;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      client: {
        driver: { findMany: jest.fn(), findUnique: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn() },
        branch: { findUnique: jest.fn() },
        deliveryAssignment: { count: jest.fn() },
      },
    };
    service = new DriversService(prisma);
  });

  describe('create', () => {
    it('rejects a branchId that does not belong to this tenant', async () => {
      prisma.client.branch.findUnique.mockResolvedValue(null);
      await expect(
        service.create('t1', { name: 'Juan', phone: '555', branchId: 'other-tenant-branch' }),
      ).rejects.toThrow(ValidationError);
    });

    it('creates a driver with no branchId (available to any branch)', async () => {
      prisma.client.driver.create.mockResolvedValue({ id: 'd1' });
      const result = await service.create('t1', { name: 'Juan', phone: '555' });
      expect(result.id).toBe('d1');
      expect(prisma.client.branch.findUnique).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('throws NotFoundError when missing', async () => {
      prisma.client.driver.findUnique.mockResolvedValue(null);
      await expect(service.update('d1', { name: 'X' })).rejects.toThrow(NotFoundError);
    });
  });

  describe('delete', () => {
    it('rejects deleting a driver with assignment history', async () => {
      prisma.client.driver.findUnique.mockResolvedValue({ id: 'd1' });
      prisma.client.deliveryAssignment.count.mockResolvedValue(2);
      await expect(service.delete('d1')).rejects.toThrow(ValidationError);
    });

    it('deletes a driver with no assignment history', async () => {
      prisma.client.driver.findUnique.mockResolvedValue({ id: 'd1' });
      prisma.client.deliveryAssignment.count.mockResolvedValue(0);
      const result = await service.delete('d1');
      expect(result).toEqual({ success: true });
    });
  });
});
