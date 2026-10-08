import { DeliveryZonesService } from './delivery-zones.service';
import { NotFoundError, ValidationError } from '@omniflow/utils';

function zone(overrides: any = {}) {
  return {
    id: 'z1',
    branchId: 'b1',
    matchType: 'ZONE_LABEL',
    zoneLabels: ['centro'],
    radiusKm: null,
    baseFee: '10',
    freeOverAmount: null,
    sortOrder: 0,
    enabled: true,
    ...overrides,
  };
}

describe('DeliveryZonesService', () => {
  let service: DeliveryZonesService;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      client: {
        deliveryZone: { findMany: jest.fn(), findUnique: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn() },
        branch: { findUnique: jest.fn() },
      },
    };
    service = new DeliveryZonesService(prisma);
  });

  describe('calculateFee', () => {
    it('covers with fee 0 when the branch has no zones configured at all', async () => {
      prisma.client.deliveryZone.findMany.mockResolvedValue([]);
      const result = await service.calculateFee('b1', {});
      expect(result).toEqual({ covered: true, fee: 0 });
    });

    it('matches a ZONE_LABEL zone case-insensitively and returns its fee', async () => {
      prisma.client.deliveryZone.findMany.mockResolvedValue([zone()]);
      const result = await service.calculateFee('b1', { zone: 'Centro' }, 100);
      expect(result).toEqual({ covered: true, fee: 10, zoneId: 'z1' });
    });

    it('is out of coverage when zones are configured but none match', async () => {
      prisma.client.deliveryZone.findMany.mockResolvedValue([zone()]);
      const result = await service.calculateFee('b1', { zone: 'otro-barrio' });
      expect(result).toEqual({ covered: false });
    });

    it('applies freeOverAmount when the subtotal reaches the threshold', async () => {
      prisma.client.deliveryZone.findMany.mockResolvedValue([zone({ freeOverAmount: '50' })]);
      const result = await service.calculateFee('b1', { zone: 'centro' }, 60);
      expect(result).toEqual({ covered: true, fee: 0, zoneId: 'z1' });
    });

    it('matches a RADIUS_KM zone against the branch coordinates', async () => {
      prisma.client.deliveryZone.findMany.mockResolvedValue([
        zone({ matchType: 'RADIUS_KM', zoneLabels: [], radiusKm: 5 }),
      ]);
      prisma.client.branch.findUnique.mockResolvedValue({ latitude: 0, longitude: 0 });
      const result = await service.calculateFee('b1', { latitude: 0.01, longitude: 0.01 });
      expect(result.covered).toBe(true);
    });

    it('never matches a RADIUS_KM zone when the branch has no coordinates configured', async () => {
      prisma.client.deliveryZone.findMany.mockResolvedValue([
        zone({ matchType: 'RADIUS_KM', zoneLabels: [], radiusKm: 5 }),
      ]);
      prisma.client.branch.findUnique.mockResolvedValue({ latitude: null, longitude: null });
      const result = await service.calculateFee('b1', { latitude: 0.01, longitude: 0.01 });
      expect(result).toEqual({ covered: false });
    });
  });

  describe('create', () => {
    it('rejects a RADIUS_KM zone when the branch has no coordinates configured', async () => {
      prisma.client.branch.findUnique.mockResolvedValue({ latitude: null, longitude: null });
      await expect(
        service.create('t1', { branchId: 'b1', name: 'Zona', matchType: 'RADIUS_KM', radiusKm: 5, baseFee: 10 } as any),
      ).rejects.toThrow(ValidationError);
    });

    it('rejects a ZONE_LABEL zone with no labels', async () => {
      await expect(
        service.create('t1', { branchId: 'b1', name: 'Zona', matchType: 'ZONE_LABEL', baseFee: 10 } as any),
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('update/delete', () => {
    it('throws NotFoundError updating a missing zone', async () => {
      prisma.client.deliveryZone.findUnique.mockResolvedValue(null);
      await expect(service.update('z1', {})).rejects.toThrow(NotFoundError);
    });

    it('throws NotFoundError deleting a missing zone', async () => {
      prisma.client.deliveryZone.findUnique.mockResolvedValue(null);
      await expect(service.delete('z1')).rejects.toThrow(NotFoundError);
    });
  });
});
