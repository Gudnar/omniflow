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
        deliveryRateProfile: {
          findFirst: jest.fn(),
          findUnique: jest.fn(),
          findMany: jest.fn(),
          create: jest.fn(),
          update: jest.fn(),
          updateMany: jest.fn(),
          delete: jest.fn(),
        },
        deliveryRateTier: { deleteMany: jest.fn() },
        $transaction: jest.fn((ops: any) => Promise.all(ops)),
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

    describe('DISTANCE_TIERS', () => {
      // ~0 km, ~1.1 km, ~2.2 km, ~4.4 km from (0,0) along the equator —
      // close enough to exercise each tier boundary without a real geo lib.
      const tieredZone = zone({ matchType: 'DISTANCE_TIERS', zoneLabels: [], radiusKm: 3 });

      it('charges the fee of the active profile tier that covers the distance', async () => {
        prisma.client.deliveryZone.findMany.mockResolvedValue([tieredZone]);
        prisma.client.branch.findUnique.mockResolvedValue({ latitude: 0, longitude: 0 });
        prisma.client.deliveryRateProfile.findFirst.mockResolvedValue({
          id: 'profile-normal',
          active: true,
          tiers: [
            { uptoKm: 1, fee: '5' },
            { uptoKm: 2, fee: '7' },
            { uptoKm: 3, fee: '10' },
          ],
        });

        // ~1.1km east of the branch — should land in the "hasta 2km" tier.
        const result = await service.calculateFee('b1', { latitude: 0, longitude: 0.01 });

        expect(result).toEqual({ covered: true, fee: 7, zoneId: 'z1' });
      });

      it('uses the currently active profile, not just the first one found', async () => {
        prisma.client.deliveryZone.findMany.mockResolvedValue([tieredZone]);
        prisma.client.branch.findUnique.mockResolvedValue({ latitude: 0, longitude: 0 });
        prisma.client.deliveryRateProfile.findFirst.mockResolvedValue({
          id: 'profile-rain',
          active: true,
          tiers: [{ uptoKm: 1, fee: '7' }],
        });

        const result = await service.calculateFee('b1', { latitude: 0, longitude: 0.005 });

        expect(prisma.client.deliveryRateProfile.findFirst).toHaveBeenCalledWith(
          expect.objectContaining({ where: { zoneId: 'z1', active: true } }),
        );
        expect(result.fee).toBe(7);
      });

      it('is out of coverage beyond the last tier', async () => {
        prisma.client.deliveryZone.findMany.mockResolvedValue([tieredZone]);
        prisma.client.branch.findUnique.mockResolvedValue({ latitude: 0, longitude: 0 });
        // Farther than the zone's own radiusKm (3) — rejected before even
        // looking at tiers.
        const result = await service.calculateFee('b1', { latitude: 0, longitude: 1 });
        expect(result).toEqual({ covered: false });
      });
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

    describe('DISTANCE_TIERS', () => {
      it('rejects when the branch has no coordinates configured', async () => {
        prisma.client.branch.findUnique.mockResolvedValue({ latitude: null, longitude: null });
        await expect(
          service.create('t1', {
            branchId: 'b1',
            name: 'Zona',
            matchType: 'DISTANCE_TIERS',
            tiers: [{ uptoKm: 1, fee: 5 }],
          } as any),
        ).rejects.toThrow(ValidationError);
      });

      it('rejects with no tiers', async () => {
        prisma.client.branch.findUnique.mockResolvedValue({ latitude: 1, longitude: 1 });
        await expect(
          service.create('t1', { branchId: 'b1', name: 'Zona', matchType: 'DISTANCE_TIERS' } as any),
        ).rejects.toThrow(ValidationError);
      });

      it('rejects two tiers with the same uptoKm', async () => {
        prisma.client.branch.findUnique.mockResolvedValue({ latitude: 1, longitude: 1 });
        await expect(
          service.create('t1', {
            branchId: 'b1',
            name: 'Zona',
            matchType: 'DISTANCE_TIERS',
            tiers: [{ uptoKm: 1, fee: 5 }, { uptoKm: 1, fee: 7 }],
          } as any),
        ).rejects.toThrow(ValidationError);
      });

      it('derives radiusKm from the farthest tier and creates a "Normal" active profile', async () => {
        prisma.client.branch.findUnique.mockResolvedValue({ latitude: 1, longitude: 1 });
        prisma.client.deliveryZone.create.mockResolvedValue({
          id: 'z1',
          baseFee: '0',
          freeOverAmount: null,
          rateProfiles: [{ id: 'p1', name: 'Normal', isDefault: true, active: true, tiers: [{ uptoKm: 2, fee: '7' }] }],
        });

        await service.create('t1', {
          branchId: 'b1',
          name: 'Zona lejos',
          matchType: 'DISTANCE_TIERS',
          tiers: [{ uptoKm: 2, fee: 7 }, { uptoKm: 1, fee: 5 }],
        } as any);

        expect(prisma.client.deliveryZone.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              radiusKm: 2,
              baseFee: 0,
              rateProfiles: {
                create: [
                  {
                    name: 'Normal',
                    isDefault: true,
                    active: true,
                    tiers: { create: [{ uptoKm: 1, fee: 5 }, { uptoKm: 2, fee: 7 }] },
                  },
                ],
              },
            }),
          }),
        );
      });
    });
  });

  describe('rate profiles', () => {
    it('rejects managing profiles on a non-DISTANCE_TIERS zone', async () => {
      prisma.client.deliveryZone.findUnique.mockResolvedValue(zone({ matchType: 'ZONE_LABEL' }));
      await expect(service.listRateProfiles('z1')).rejects.toThrow(ValidationError);
    });

    it('activateRateProfile deactivates every other profile of the zone first', async () => {
      prisma.client.deliveryZone.findUnique.mockResolvedValue(zone({ matchType: 'DISTANCE_TIERS' }));
      prisma.client.deliveryRateProfile.findUnique.mockResolvedValue({ id: 'p2', zoneId: 'z1' });

      await service.activateRateProfile('z1', 'p2');

      expect(prisma.client.deliveryRateProfile.updateMany).toHaveBeenCalledWith({
        where: { zoneId: 'z1' },
        data: { active: false },
      });
      expect(prisma.client.deliveryRateProfile.update).toHaveBeenCalledWith({
        where: { id: 'p2' },
        data: { active: true },
      });
    });

    it('rejects deleting the default "Normal" profile', async () => {
      prisma.client.deliveryRateProfile.findUnique.mockResolvedValue({ id: 'p1', isDefault: true, active: false });
      await expect(service.deleteRateProfile('p1')).rejects.toThrow(ValidationError);
    });

    it('rejects deleting the currently active profile', async () => {
      prisma.client.deliveryRateProfile.findUnique.mockResolvedValue({ id: 'p2', isDefault: false, active: true });
      await expect(service.deleteRateProfile('p2')).rejects.toThrow(ValidationError);
    });

    it('deletes a non-default, inactive profile', async () => {
      prisma.client.deliveryRateProfile.findUnique.mockResolvedValue({ id: 'p2', isDefault: false, active: false });
      const result = await service.deleteRateProfile('p2');
      expect(result).toEqual({ success: true });
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
