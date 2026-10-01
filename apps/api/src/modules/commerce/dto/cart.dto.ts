import { IsString, IsInt, Min, IsOptional, IsEnum } from 'class-validator';
import { FulfillmentType } from '@omniflow/database';

export class AddCartItemDto {
  @IsString()
  declare variantId: string;

  @IsInt()
  @Min(1)
  declare quantity: number;
}

export class UpdateCartItemDto {
  @IsInt()
  @Min(1)
  declare quantity: number;
}

export class UpdateCartDto {
  @IsString()
  declare branchId: string;
}

export class CheckoutDto {
  @IsEnum(FulfillmentType)
  declare fulfillmentType: FulfillmentType;

  @IsString()
  @IsOptional()
  declare addressId?: string;
}
