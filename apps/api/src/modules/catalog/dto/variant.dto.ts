import { IsString, MinLength, IsOptional, IsObject, IsInt } from 'class-validator';

export class CreateVariantDto {
  @IsString()
  @IsOptional()
  declare name?: string;

  @IsString()
  @MinLength(1)
  declare sku: string;

  @IsObject()
  @IsOptional()
  declare attributes?: Record<string, unknown>;

  @IsInt()
  @IsOptional()
  declare sortOrder?: number;
}

export class UpdateVariantDto {
  @IsString()
  @IsOptional()
  declare name?: string;

  @IsString()
  @MinLength(1)
  @IsOptional()
  declare sku?: string;

  @IsObject()
  @IsOptional()
  declare attributes?: Record<string, unknown>;

  @IsInt()
  @IsOptional()
  declare sortOrder?: number;
}
