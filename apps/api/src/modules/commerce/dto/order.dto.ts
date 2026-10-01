import { IsString, IsOptional, IsEnum, IsDateString } from 'class-validator';
import { OrderStatus, FulfillmentType } from '@omniflow/database';

export class ListOrdersQueryDto {
  @IsEnum(OrderStatus)
  @IsOptional()
  declare status?: OrderStatus;

  @IsString()
  @IsOptional()
  declare branchId?: string;
}

export class UpdateOrderStatusDto {
  @IsEnum(OrderStatus)
  declare status: OrderStatus;

  @IsString()
  @IsOptional()
  declare note?: string;

  // Phase 18: Manual fulfillment — who actually received the pickup/
  // delivery. Only meaningful when status is DELIVERED; harmless no-op
  // otherwise.
  @IsString()
  @IsOptional()
  declare receivedByName?: string;
}

export class CancelOrderDto {
  @IsString()
  @IsOptional()
  declare note?: string;
}

export class UpdateOrderTrackingCodeDto {
  @IsString()
  declare trackingCode: string;
}

export class UpdateOrderFulfillmentDto {
  @IsEnum(FulfillmentType)
  declare fulfillmentType: FulfillmentType;

  @IsString()
  @IsOptional()
  declare addressId?: string;

  // Optional scheduled pickup/delivery time (DATABASE.md's `scheduled_at`).
  @IsDateString()
  @IsOptional()
  declare scheduledAt?: string;
}
