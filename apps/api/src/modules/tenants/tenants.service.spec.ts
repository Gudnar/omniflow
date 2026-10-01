import { TenantsService } from './tenants.service';
import { NotFoundError } from '@omniflow/utils';

describe('TenantsService', () => {
  let service: TenantsService;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      client: {
        tenant: { findUnique: jest.fn(), update: jest.fn() },
      },
    };
    service = new TenantsService(prisma);
  });

  describe('get', () => {
    it('throws NotFoundError when the tenant does not exist', async () => {
      prisma.client.tenant.findUnique.mockResolvedValue(null);
      await expect(service.get('t1')).rejects.toThrow(NotFoundError);
    });

    it('returns the tenant with only the safe select fields', async () => {
      prisma.client.tenant.findUnique.mockResolvedValue({ id: 't1', name: 'Acme' });
      const result = await service.get('t1');
      expect(result).toEqual({ id: 't1', name: 'Acme' });
      expect(prisma.client.tenant.findUnique).toHaveBeenCalledWith({
        where: { id: 't1' },
        select: expect.objectContaining({ taxId: true, timezone: true, currency: true }),
      });
    });
  });

  describe('update', () => {
    it('verifies the tenant exists then updates only the provided fields', async () => {
      prisma.client.tenant.findUnique.mockResolvedValue({ id: 't1' });
      prisma.client.tenant.update.mockResolvedValue({ id: 't1', name: 'New name' });

      const result = await service.update('t1', { name: 'New name' } as any);

      expect(prisma.client.tenant.update).toHaveBeenCalledWith({
        where: { id: 't1' },
        data: { name: 'New name' },
        select: expect.any(Object),
      });
      expect(result.name).toBe('New name');
    });
  });
});
