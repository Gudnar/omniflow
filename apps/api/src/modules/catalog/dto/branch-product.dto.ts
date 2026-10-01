import { IsNumber, IsOptional, IsEnum, IsInt, Min, IsString } from 'class-validator';
import { BranchProductStatus, InventoryMovementType } from '@omniflow/database';

export class UpdateBranchProductDto {
  @IsNumber()
  @Min(0)
  @IsOptional()
  declare price?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  declare compareAtPrice?: number;

  @IsInt()
  @IsOptional()
  declare minStock?: number;

  @IsInt()
  @IsOptional()
  declare maxStock?: number;

  @IsInt()
  @IsOptional()
  declare reorderPoint?: number;

  @IsEnum(BranchProductStatus)
  @IsOptional()
  declare status?: BranchProductStatus;
}

export class AdjustStockDto {
  @IsEnum(InventoryMovementType)
  declare type: InventoryMovementType;

  @IsInt()
  declare quantityChange: number;

  @IsString()
  @IsOptional()
  declare note?: string;
}
