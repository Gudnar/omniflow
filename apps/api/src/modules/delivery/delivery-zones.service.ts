import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundError, ValidationError } from '@omniflow/utils';
import {
  CreateDeliveryZoneDto,
  UpdateDeliveryZoneDto,
  CreateRateProfileDto,
  UpdateRateProfileDto,
  RateTierInput,
} from './delivery-zone.dto';

export interface DeliveryQuoteAddress {
  zone?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}

export interface DeliveryQuoteResult {
  covered: boolean;
  fee?: number;
  zoneId?: string;
}

function serializeZone(zone: any) {
  return {
    ...zone,
    baseFee: zone.baseFee === null ? null : Number(zone.baseFee),
    freeOverAmount: zone.freeOverAmount === null ? null : Number(zone.freeOverAmount),
  };
}

function serializeRateProfile(profile: any) {
  return {
    ...profile,
    tiers: profile.tiers?.map((t: any) => ({ ...t, fee: Number(t.fee) })),
  };
}

// Normaliza y valida los tramos: al menos uno, uptoKm/fee no negativos, sin
// dos tramos con el mismo uptoKm, devueltos ascendentes — así calculateFee
// puede confiar en el orden sin volver a ordenar.
function normalizeTiers(tiers: RateTierInput[] | undefined): RateTierInput[] {
  if (!tiers?.length) {
    throw new ValidationError('Los tramos de distancia son obligatorios (al menos uno).');
  }
  for (const t of tiers) {
    if (t.uptoKm == null || t.uptoKm <= 0 || t.fee == null || t.fee < 0) {
      throw new ValidationError('Cada tramo necesita uptoKm > 0 y fee >= 0.');
    }
  }
  const sorted = [...tiers].sort((a, b) => a.uptoKm - b.uptoKm);
  const seen = new Set<number>();
  for (const t of sorted) {
    if (seen.has(t.uptoKm)) throw new ValidationError(`Hay dos tramos repetidos para ${t.uptoKm} km.`);
    seen.add(t.uptoKm);
  }
  return sorted;
}

// Haversine distance in km — good enough for a "is this address within N km
// of the branch" check; no need for a mapping SDK for a circle.
function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

@Injectable()
export class DeliveryZonesService {
  constructor(private prisma: PrismaService) {}

  async list(branchId: string) {
    const zones = await this.prisma.client.deliveryZone.findMany({
      where: { branchId },
      orderBy: { sortOrder: 'asc' },
      include: { rateProfiles: { include: { tiers: { orderBy: { uptoKm: 'asc' } } } } },
    });
    return zones.map((z: any) => ({ ...serializeZone(z), rateProfiles: z.rateProfiles.map(serializeRateProfile) }));
  }

  private async assertBranchHasCoordinates(branchId: string) {
    const branch = await this.prisma.client.branch.findUnique({ where: { id: branchId } });
    if (!branch?.latitude || !branch?.longitude) {
      throw new ValidationError(
        'Esta sucursal no tiene coordenadas configuradas; no se puede usar una zona por radio o por tramos de distancia.',
      );
    }
  }

  async create(tenantId: string, dto: CreateDeliveryZoneDto) {
    if (dto.matchType === 'ZONE_LABEL' && !dto.zoneLabels?.length) {
      throw new ValidationError('zoneLabels es obligatorio cuando matchType es ZONE_LABEL');
    }
    if (dto.matchType === 'RADIUS_KM') {
      if (dto.radiusKm == null) {
        throw new ValidationError('radiusKm es obligatorio cuando matchType es RADIUS_KM');
      }
      await this.assertBranchHasCoordinates(dto.branchId);
    }
    if (dto.matchType !== 'DISTANCE_TIERS' && dto.baseFee == null) {
      throw new ValidationError('baseFee es obligatorio salvo en zonas por tramos de distancia');
    }

    let tiers: RateTierInput[] | null = null;
    let radiusKm = dto.radiusKm;
    if (dto.matchType === 'DISTANCE_TIERS') {
      await this.assertBranchHasCoordinates(dto.branchId);
      tiers = normalizeTiers(dto.tiers);
      radiusKm = tiers[tiers.length - 1].uptoKm;
    }

    const zone = await this.prisma.client.deliveryZone.create({
      data: {
        tenantId,
        branchId: dto.branchId,
        name: dto.name,
        matchType: dto.matchType,
        zoneLabels: dto.zoneLabels ?? [],
        radiusKm,
        baseFee: dto.matchType === 'DISTANCE_TIERS' ? 0 : dto.baseFee!,
        freeOverAmount: dto.freeOverAmount,
        sortOrder: dto.sortOrder ?? 0,
        ...(tiers && {
          rateProfiles: {
            create: [{ name: 'Normal', isDefault: true, active: true, tiers: { create: tiers } }],
          },
        }),
      },
      include: { rateProfiles: { include: { tiers: true } } },
    });
    return { ...serializeZone(zone), rateProfiles: (zone as any).rateProfiles.map(serializeRateProfile) };
  }

  async update(id: string, dto: UpdateDeliveryZoneDto) {
    const existing = await this.prisma.client.deliveryZone.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError('DeliveryZone');
    if (dto.matchType && (dto.matchType === 'DISTANCE_TIERS') !== (existing.matchType === 'DISTANCE_TIERS')) {
      throw new ValidationError(
        'No se puede cambiar a o desde "tramos de distancia" editando la zona — creá una zona nueva.',
      );
    }

    const zone = await this.prisma.client.deliveryZone.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.matchType !== undefined && { matchType: dto.matchType }),
        ...(dto.zoneLabels !== undefined && { zoneLabels: dto.zoneLabels }),
        ...(dto.radiusKm !== undefined && { radiusKm: dto.radiusKm }),
        ...(dto.baseFee !== undefined && { baseFee: dto.baseFee }),
        ...(dto.freeOverAmount !== undefined && { freeOverAmount: dto.freeOverAmount }),
        ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
        ...(dto.enabled !== undefined && { enabled: dto.enabled }),
      },
    });
    return serializeZone(zone);
  }

  async delete(id: string) {
    const existing = await this.prisma.client.deliveryZone.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError('DeliveryZone');
    await this.prisma.client.deliveryZone.delete({ where: { id } });
    return { success: true };
  }

  // ---- Tarifas especiales (DISTANCE_TIERS) --------------------------------

  private async getTieredZone(zoneId: string) {
    const zone = await this.prisma.client.deliveryZone.findUnique({ where: { id: zoneId } });
    if (!zone) throw new NotFoundError('DeliveryZone');
    if (zone.matchType !== 'DISTANCE_TIERS') {
      throw new ValidationError('Esta zona no cobra por tramos de distancia.');
    }
    return zone;
  }

  async listRateProfiles(zoneId: string) {
    await this.getTieredZone(zoneId);
    const profiles = await this.prisma.client.deliveryRateProfile.findMany({
      where: { zoneId },
      include: { tiers: { orderBy: { uptoKm: 'asc' } } },
      orderBy: { createdAt: 'asc' },
    });
    return profiles.map(serializeRateProfile);
  }

  async createRateProfile(zoneId: string, dto: CreateRateProfileDto) {
    await this.getTieredZone(zoneId);
    const tiers = normalizeTiers(dto.tiers);
    const profile = await this.prisma.client.deliveryRateProfile.create({
      data: { zoneId, name: dto.name, isDefault: false, active: false, tiers: { create: tiers } },
      include: { tiers: true },
    });
    return serializeRateProfile(profile);
  }

  async updateRateProfile(id: string, dto: UpdateRateProfileDto) {
    const existing = await this.prisma.client.deliveryRateProfile.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError('DeliveryRateProfile');

    if (dto.tiers) {
      const tiers = normalizeTiers(dto.tiers);
      await this.prisma.client.$transaction([
        this.prisma.client.deliveryRateTier.deleteMany({ where: { rateProfileId: id } }),
        this.prisma.client.deliveryRateProfile.update({
          where: { id },
          data: {
            ...(dto.name !== undefined && { name: dto.name }),
            tiers: { create: tiers },
          },
        }),
      ]);
    } else if (dto.name !== undefined) {
      await this.prisma.client.deliveryRateProfile.update({ where: { id }, data: { name: dto.name } });
    }

    const profile = await this.prisma.client.deliveryRateProfile.findUnique({
      where: { id },
      include: { tiers: { orderBy: { uptoKm: 'asc' } } },
    });
    return serializeRateProfile(profile);
  }

  // Activa este perfil y desactiva cualquier otro de la misma zona — exactamente
  // uno activo a la vez, igual que DeliveryAssignment.unassignedAt pero con un
  // simple flip de boolean (no se pide historial de qué estuvo activo cuándo).
  async activateRateProfile(zoneId: string, profileId: string) {
    await this.getTieredZone(zoneId);
    const profile = await this.prisma.client.deliveryRateProfile.findUnique({ where: { id: profileId } });
    if (!profile || profile.zoneId !== zoneId) throw new NotFoundError('DeliveryRateProfile');

    await this.prisma.client.$transaction([
      this.prisma.client.deliveryRateProfile.updateMany({ where: { zoneId }, data: { active: false } }),
      this.prisma.client.deliveryRateProfile.update({ where: { id: profileId }, data: { active: true } }),
    ]);
    return { success: true };
  }

  async deleteRateProfile(id: string) {
    const existing = await this.prisma.client.deliveryRateProfile.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError('DeliveryRateProfile');
    if (existing.isDefault) throw new ValidationError('No se puede eliminar el perfil "Normal".');
    if (existing.active) throw new ValidationError('No se puede eliminar el perfil activo — activá otro primero.');
    await this.prisma.client.deliveryRateProfile.delete({ where: { id } });
    return { success: true };
  }

  // No zones configured at all for this branch → the feature isn't in use,
  // keep today's behavior (covered, no fee). Zones configured but none
  // match → genuinely out of coverage, never silently charge $0.
  async calculateFee(branchId: string, address: DeliveryQuoteAddress, subtotal = 0): Promise<DeliveryQuoteResult> {
    const zones = await this.prisma.client.deliveryZone.findMany({
      where: { branchId, enabled: true },
      orderBy: { sortOrder: 'asc' },
    });
    if (zones.length === 0) return { covered: true, fee: 0 };

    let branch: { latitude: number | null; longitude: number | null } | null = null;
    for (const zone of zones) {
      if (zone.matchType === 'ZONE_LABEL') {
        if (
          address.zone &&
          zone.zoneLabels.some((label: string) => label.toLowerCase() === address.zone!.toLowerCase())
        ) {
          return this.resolveFlatFee(zone, subtotal);
        }
        continue;
      }

      if (address.latitude == null || address.longitude == null) continue;
      if (branch === null) {
        branch = await this.prisma.client.branch.findUnique({
          where: { id: branchId },
          select: { latitude: true, longitude: true },
        });
      }
      if (branch?.latitude == null || branch?.longitude == null || zone.radiusKm == null) continue;
      const distance = distanceKm(branch.latitude, branch.longitude, address.latitude, address.longitude);
      if (distance > zone.radiusKm) continue;

      if (zone.matchType === 'RADIUS_KM') {
        return this.resolveFlatFee(zone, subtotal);
      }
      if (zone.matchType === 'DISTANCE_TIERS') {
        const result = await this.resolveTieredFee(zone, distance, subtotal);
        if (result) return result;
      }
    }
    return { covered: false };
  }

  private resolveFlatFee(zone: any, subtotal: number): DeliveryQuoteResult {
    const freeOverAmount = zone.freeOverAmount === null ? null : Number(zone.freeOverAmount);
    const fee = freeOverAmount !== null && subtotal >= freeOverAmount ? 0 : Number(zone.baseFee);
    return { covered: true, fee, zoneId: zone.id };
  }

  private async resolveTieredFee(zone: any, distanceKmValue: number, subtotal: number): Promise<DeliveryQuoteResult | null> {
    const activeProfile = await this.prisma.client.deliveryRateProfile.findFirst({
      where: { zoneId: zone.id, active: true },
      include: { tiers: { orderBy: { uptoKm: 'asc' } } },
    });
    if (!activeProfile) return null;

    const tier = activeProfile.tiers.find((t: any) => distanceKmValue <= t.uptoKm);
    if (!tier) return null;

    const freeOverAmount = zone.freeOverAmount === null ? null : Number(zone.freeOverAmount);
    const fee = freeOverAmount !== null && subtotal >= freeOverAmount ? 0 : Number(tier.fee);
    return { covered: true, fee, zoneId: zone.id };
  }
}
