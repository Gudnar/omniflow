import { IsString, MinLength, IsOptional, IsEnum, IsArray, IsBoolean } from 'class-validator';
import { EcommerceOperationMode } from '@omniflow/database';

export class UpdateStoreDto {
  @IsString()
  @MinLength(1)
  @IsOptional()
  declare name?: string;

  @IsString()
  @MinLength(1)
  @IsOptional()
  declare slug?: string;

  @IsEnum(EcommerceOperationMode)
  @IsOptional()
  declare operationMode?: EcommerceOperationMode;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  declare branchIds?: string[];

  @IsBoolean()
  @IsOptional()
  declare chatEnabled?: boolean;
}
