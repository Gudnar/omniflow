import { IsString, IsDateString, IsOptional, IsEnum, IsArray, ArrayNotEmpty, ArrayUnique } from 'class-validator';
import { DeliveryRouteStatus } from '@omniflow/database';

export class ListDeliveryRoutesQueryDto {
  @IsString()
  @IsOptional()
  declare branchId?: string;

  @IsDateString()
  @IsOptional()
  declare routeDate?: string;

  @IsEnum(DeliveryRouteStatus)
  @IsOptional()
  declare status?: DeliveryRouteStatus;
}

export class CreateDeliveryRouteDto {
  @IsString()
  declare branchId: string;

  @IsDateString()
  declare routeDate: string;

  @IsString()
  @IsOptional()
  declare responsibleUserId?: string;

  @IsString()
  @IsOptional()
  declare notes?: string;
}

export class UpdateDeliveryRouteDto {
  @IsString()
  @IsOptional()
  declare responsibleUserId?: string;

  @IsString()
  @IsOptional()
  declare notes?: string;

  // Only CANCELLED is accepted here — PLANNED/IN_ROUTE/etc. are driven by
  // start()/complete(), not a free-form status edit.
  @IsEnum(DeliveryRouteStatus)
  @IsOptional()
  declare status?: DeliveryRouteStatus;
}

export class AddRouteStopDto {
  @IsString()
  declare fulfillmentId: string;
}

export class ReorderRouteStopsDto {
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsString({ each: true })
  declare stopIds: string[];
}

export class FailRouteStopDto {
  @IsString()
  @IsOptional()
  declare note?: string;
}

export class AssignDriverDto {
  @IsString()
  declare driverId: string;

  @IsString()
  @IsOptional()
  declare vehicleId?: string;
}
