import { IsString, IsOptional, IsArray, IsEnum } from 'class-validator';
import { AppointmentStatus } from '@omniflow/database';

export class AvailabilityQueryDto {
  @IsString()
  declare serviceId: string;

  @IsString()
  declare branchId: string;

  @IsString()
  declare date: string;
}

export class CreateAppointmentDto {
  @IsString()
  declare contactId: string;

  @IsString()
  declare branchId: string;

  @IsArray()
  @IsString({ each: true })
  declare serviceIds: string[];

  @IsString()
  declare startAt: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  declare resourceIds?: string[];

  @IsString()
  @IsOptional()
  declare addressId?: string;

  @IsString()
  @IsOptional()
  declare notes?: string;
}

export class RescheduleAppointmentDto {
  @IsString()
  @IsOptional()
  declare startAt?: string;

  @IsString()
  @IsOptional()
  declare endAt?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  declare resourceIds?: string[];

  @IsString()
  @IsOptional()
  declare notes?: string;
}

export class ListAppointmentsQueryDto {
  @IsEnum(AppointmentStatus)
  @IsOptional()
  declare status?: AppointmentStatus;

  @IsString()
  @IsOptional()
  declare branchId?: string;

  @IsString()
  @IsOptional()
  declare contactId?: string;
}

export class UpdateAppointmentStatusDto {
  @IsEnum(AppointmentStatus)
  declare status: AppointmentStatus;

  @IsString()
  @IsOptional()
  declare note?: string;
}

export class CancelAppointmentDto {
  @IsString()
  @IsOptional()
  declare note?: string;
}
