import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundError, ValidationError } from '@omniflow/utils';
import { CreateDeliveryZoneDto, UpdateDeliveryZoneDto } from './delivery-zone.dto';

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
    baseFee: Number(zone.baseFee),
    freeOverAmount: zone.freeOverAmount === null ? null : Number(zone.freeOverAmount),
  };
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
    });
    return zones.map(serializeZone);
  }

  async create(tenantId: string, dto: CreateDeliveryZoneDto) {
    if (dto.matchType === 'ZONE_LABEL' && !dto.zoneLabels?.length) {
      throw new ValidationError('zoneLabels es obligatorio cuando matchType es ZONE_LABEL');
    }
    if (dto.matchType === 'RADIUS_KM') {
      if (dto.radiusKm == null) {
        throw new ValidationError('radiusKm es obligatorio cuando matchType es RADIUS_KM');
      }
      const branch = await this.prisma.client.branch.findUnique({ where: { id: dto.branchId } });
      if (!branch?.latitude || !branch?.longitude) {
        throw new ValidationError(
          'Esta sucursal no tiene coordenadas configuradas; no se puede usar una zona por radio.',
        );
      }
    }

    const zone = await this.prisma.client.deliveryZone.create({
      data: {
        tenantId,
        branchId: dto.branchId,
        name: dto.name,
        matchType: dto.matchType,
        zoneLabels: dto.zoneLabels ?? [],
        radiusKm: dto.radiusKm,
        baseFee: dto.baseFee,
        freeOverAmount: dto.freeOverAmount,
        sortOrder: dto.sortOrder ?? 0,
      },
    });
    return serializeZone(zone);
  }

  async update(id: string, dto: UpdateDeliveryZoneDto) {
    const existing = await this.prisma.client.deliveryZone.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError('DeliveryZone');

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
          return this.resolveFee(zone, subtotal);
        }
      } else if (zone.matchType === 'RADIUS_KM' && address.latitude != null && address.longitude != null) {
        if (branch === null) {
          branch = await this.prisma.client.branch.findUnique({
            where: { id: branchId },
            select: { latitude: true, longitude: true },
          });
        }
        if (branch?.latitude != null && branch?.longitude != null && zone.radiusKm != null) {
          const distance = distanceKm(branch.latitude, branch.longitude, address.latitude, address.longitude);
          if (distance <= zone.radiusKm) {
            return this.resolveFee(zone, subtotal);
          }
        }
      }
    }
    return { covered: false };
  }

  private resolveFee(zone: any, subtotal: number): DeliveryQuoteResult {
    const freeOverAmount = zone.freeOverAmount === null ? null : Number(zone.freeOverAmount);
    const fee = freeOverAmount !== null && subtotal >= freeOverAmount ? 0 : Number(zone.baseFee);
    return { covered: true, fee, zoneId: zone.id };
  }
}
