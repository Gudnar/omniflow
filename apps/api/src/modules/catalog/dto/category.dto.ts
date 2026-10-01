import { IsString, MinLength, IsOptional, IsEnum, IsInt } from 'class-validator';
import { CategoryStatus } from '@omniflow/database';

export class CreateCategoryDto {
  @IsString()
  @MinLength(1)
  declare name: string;

  @IsString()
  @MinLength(1)
  declare slug: string;

  @IsString()
  @IsOptional()
  declare parentId?: string;

  @IsInt()
  @IsOptional()
  declare sortOrder?: number;
}

export class UpdateCategoryDto {
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
  declare parentId?: string;

  @IsInt()
  @IsOptional()
  declare sortOrder?: number;

  @IsEnum(CategoryStatus)
  @IsOptional()
  declare status?: CategoryStatus;
}
