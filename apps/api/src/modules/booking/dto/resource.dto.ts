import { IsString, MinLength, IsOptional, IsEnum, IsInt, Min, Max } from 'class-validator';
import { BookingResourceType, BookingResourceStatus } from '@omniflow/database';

export class CreateResourceDto {
  @IsString()
  declare branchId: string;

  @IsString()
  @MinLength(1)
  declare name: string;

  @IsEnum(BookingResourceType)
  declare type: BookingResourceType;

  @IsString()
  @IsOptional()
  declare userId?: string;

  @IsEnum(BookingResourceStatus)
  @IsOptional()
  declare status?: BookingResourceStatus;
}

export class UpdateResourceDto {
  @IsString()
  @IsOptional()
  declare branchId?: string;

  @IsString()
  @MinLength(1)
  @IsOptional()
  declare name?: string;

  @IsEnum(BookingResourceType)
  @IsOptional()
  declare type?: BookingResourceType;

  @IsString()
  @IsOptional()
  declare userId?: string;

  @IsEnum(BookingResourceStatus)
  @IsOptional()
  declare status?: BookingResourceStatus;
}

export class CreateScheduleEntryDto {
  @IsInt()
  @Min(0)
  @Max(6)
  declare dayOfWeek: number;

  @IsInt()
  @Min(0)
  @Max(1439)
  declare startMinute: number;

  @IsInt()
  @Min(1)
  @Max(1440)
  declare endMinute: number;
}

export class UpdateScheduleEntryDto {
  @IsInt()
  @Min(0)
  @Max(6)
  @IsOptional()
  declare dayOfWeek?: number;

  @IsInt()
  @Min(0)
  @Max(1439)
  @IsOptional()
  declare startMinute?: number;

  @IsInt()
  @Min(1)
  @Max(1440)
  @IsOptional()
  declare endMinute?: number;
}
