import { IsString, IsEnum, IsOptional, IsArray, IsNumber, Min, IsBoolean, IsInt } from 'class-validator';
import { DeliveryZoneMatchType } from '@omniflow/database';

// { uptoKm: 1, fee: 5 } — "hasta 1km, 5 bs". Validado a mano en el service
// (la forma exacta de la lista de tramos no justifica una clase anidada).
export interface RateTierInput {
  uptoKm: number;
  fee: number;
}

export class CreateDeliveryZoneDto {
  @IsString()
  declare branchId: string;

  @IsString()
  declare name: string;

  @IsEnum(DeliveryZoneMatchType)
  declare matchType: DeliveryZoneMatchType;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  declare zoneLabels?: string[];

  // RADIUS_KM: radio de cobertura. DISTANCE_TIERS: se ignora, se calcula
  // solo del último tramo en `tiers`.
  @IsNumber()
  @Min(0)
  @IsOptional()
  declare radiusKm?: number;

  // Obligatorio salvo en DISTANCE_TIERS (ahí la tarifa sale de `tiers`).
  @IsNumber()
  @Min(0)
  @IsOptional()
  declare baseFee?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  declare freeOverAmount?: number;

  @IsInt()
  @IsOptional()
  declare sortOrder?: number;

  // Solo DISTANCE_TIERS — tramos de la tarifa "Normal" inicial.
  @IsArray()
  @IsOptional()
  declare tiers?: RateTierInput[];
}

export class UpdateDeliveryZoneDto {
  @IsString()
  @IsOptional()
  declare name?: string;

  @IsEnum(DeliveryZoneMatchType)
  @IsOptional()
  declare matchType?: DeliveryZoneMatchType;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  declare zoneLabels?: string[];

  @IsNumber()
  @Min(0)
  @IsOptional()
  declare radiusKm?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  declare baseFee?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  declare freeOverAmount?: number;

  @IsInt()
  @IsOptional()
  declare sortOrder?: number;

  @IsBoolean()
  @IsOptional()
  declare enabled?: boolean;
}

export class CreateRateProfileDto {
  @IsString()
  declare name: string;

  @IsArray()
  declare tiers: RateTierInput[];
}

export class UpdateRateProfileDto {
  @IsString()
  @IsOptional()
  declare name?: string;

  @IsArray()
  @IsOptional()
  declare tiers?: RateTierInput[];
}

export class DeliveryQuoteDto {
  @IsString()
  @IsOptional()
  declare zoneLabel?: string;

  @IsNumber()
  @IsOptional()
  declare latitude?: number;

  @IsNumber()
  @IsOptional()
  declare longitude?: number;
}
