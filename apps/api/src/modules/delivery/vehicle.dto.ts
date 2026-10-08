import { IsString, IsOptional, IsEnum } from 'class-validator';
import { VehicleType } from '@omniflow/database';

export class CreateVehicleDto {
  @IsEnum(VehicleType)
  declare type: VehicleType;

  @IsString()
  @IsOptional()
  declare branchId?: string;

  @IsString()
  @IsOptional()
  declare label?: string;

  @IsString()
  @IsOptional()
  declare plate?: string;

  @IsString()
  @IsOptional()
  declare notes?: string;
}

export class UpdateVehicleDto {
  @IsEnum(VehicleType)
  @IsOptional()
  declare type?: VehicleType;

  @IsString()
  @IsOptional()
  declare branchId?: string;

  @IsString()
  @IsOptional()
  declare label?: string;

  @IsString()
  @IsOptional()
  declare plate?: string;

  @IsString()
  @IsOptional()
  declare notes?: string;
}
