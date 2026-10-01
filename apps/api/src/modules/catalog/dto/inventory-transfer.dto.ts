import { IsString, IsOptional, IsArray, ValidateNested, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class TransferItemDto {
  @IsString()
  declare variantId: string;

  @IsInt()
  @Min(1)
  declare quantity: number;
}

export class CreateTransferDto {
  @IsString()
  declare fromBranchId: string;

  @IsString()
  declare toBranchId: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TransferItemDto)
  declare items: TransferItemDto[];

  @IsString()
  @IsOptional()
  declare note?: string;
}
