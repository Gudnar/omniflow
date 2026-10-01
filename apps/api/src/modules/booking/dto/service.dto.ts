import { IsString, MinLength, IsOptional, IsInt, Min, IsNumber, IsEnum } from 'class-validator';
import { BookingServiceStatus } from '@omniflow/database';

export class CreateServiceDto {
  @IsString()
  @MinLength(1)
  declare name: string;

  @IsString()
  @MinLength(1)
  declare slug: string;

  @IsString()
  @IsOptional()
  declare description?: string;

  @IsInt()
  @Min(1)
  declare durationMinutes: number;

  @IsNumber()
  @Min(0)
  declare price: number;

  @IsEnum(BookingServiceStatus)
  @IsOptional()
  declare status?: BookingServiceStatus;
}

export class UpdateServiceDto {
  @IsString()
  @MinLength(1)
  @IsOptional()
  declare name?: string;

  @IsString()
  @MinLength(1)
  @IsOptional()
  declare slug?: string;

  @IsString()
  @IsOptional()
  declare description?: string;

  @IsInt()
  @Min(1)
  @IsOptional()
  declare durationMinutes?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  declare price?: number;

  @IsEnum(BookingServiceStatus)
  @IsOptional()
  declare status?: BookingServiceStatus;
}
