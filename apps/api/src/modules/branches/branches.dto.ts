import { IsString, IsOptional, MinLength, IsEnum, IsInt, IsNumber, Min } from 'class-validator';
import { BranchStatus } from '@omniflow/database';

export class CreateBranchDto {
  @IsString()
  @MinLength(1)
  declare name: string;

  @IsString()
  @IsOptional()
  declare address?: string;

  @IsNumber()
  @IsOptional()
  declare latitude?: number;

  @IsNumber()
  @IsOptional()
  declare longitude?: number;

  @IsString()
  @IsOptional()
  declare timezone?: string;
}

export class UpdateBranchDto {
  @IsString()
  @MinLength(1)
  @IsOptional()
  declare name?: string;

  @IsString()
  @IsOptional()
  declare address?: string;

  @IsNumber()
  @IsOptional()
  declare latitude?: number;

  @IsNumber()
  @IsOptional()
  declare longitude?: number;

  @IsString()
  @IsOptional()
  declare timezone?: string;

  @IsEnum(BranchStatus)
  @IsOptional()
  declare status?: BranchStatus;

  @IsInt()
  @Min(0)
  @IsOptional()
  declare minBookingLeadDays?: number;
}
