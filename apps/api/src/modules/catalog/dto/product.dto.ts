import { IsString, MinLength, IsOptional, IsEnum, ValidateNested, IsArray, IsBoolean, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ProductStatus } from '@omniflow/database';
import { CreateVariantDto } from './variant.dto';

export class CreateProductDto {
  @IsString()
  @MinLength(1)
  declare name: string;

  @IsString()
  @MinLength(1)
  declare slug: string;

  @IsString()
  @IsOptional()
  declare description?: string;

  @IsString()
  @IsOptional()
  declare categoryId?: string;

  @IsEnum(ProductStatus)
  @IsOptional()
  declare status?: ProductStatus;

  @IsBoolean()
  @IsOptional()
  declare requiresPreparation?: boolean;

  @IsString()
  @IsOptional()
  declare preparationReason?: string;

  @IsInt()
  @Min(1)
  @IsOptional()
  declare preparationMinutes?: number;

  // Optional — if omitted, ProductsService creates one implicit default variant.
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateVariantDto)
  @IsOptional()
  declare variants?: CreateVariantDto[];
}

export class UpdateProductDto {
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

  @IsString()
  @IsOptional()
  declare categoryId?: string;

  @IsEnum(ProductStatus)
  @IsOptional()
  declare status?: ProductStatus;

  @IsBoolean()
  @IsOptional()
  declare requiresPreparation?: boolean;

  @IsString()
  @IsOptional()
  declare preparationReason?: string;

  @IsInt()
  @Min(1)
  @IsOptional()
  declare preparationMinutes?: number;
}
