import { IsString, IsEnum, IsOptional, IsArray, IsNumber, Min, IsBoolean, IsInt } from 'class-validator';
import { DeliveryZoneMatchType } from '@omniflow/database';

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

  @IsNumber()
  @Min(0)
  @IsOptional()
  declare radiusKm?: number;

  @IsNumber()
  @Min(0)
  declare baseFee: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  declare freeOverAmount?: number;

  @IsInt()
  @IsOptional()
  declare sortOrder?: number;
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
