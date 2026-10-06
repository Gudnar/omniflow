import { IsString, IsOptional, IsArray, IsEnum, ValidateNested, ArrayMinSize } from 'class-validator';
import { Type } from 'class-transformer';
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

  // Who this appointment is for, when it's not the booking contact
  // themself — e.g. a parent booking a pediatric checkup for a child.
  @IsString()
  @IsOptional()
  declare patientName?: string;

  // Internal-only — set exclusively by BookingStorefrontService.bookAppointment()
  // from the already-resolved session token, never from client input
  // (undecorated so the global ValidationPipe's forbidNonWhitelisted strips
  // it from any HTTP body). Lets AppointmentsService.create() know which
  // conversation to send the confirmation images into.
  declare commerceSessionId?: string;

  // Internal-only — set exclusively by AppointmentsService.createGroup() to
  // tag sibling appointments booked together, and to tell create() not to
  // send its own per-appointment confirmation images (createGroup() sends
  // one combined set for the whole group instead). Same undecorated
  // protection as commerceSessionId above.
  declare groupId?: string;
  declare skipConfirmationImages?: boolean;
}

export class CreateAppointmentGroupPatientDto {
  @IsString()
  declare patientName: string;

  @IsArray()
  @IsString({ each: true })
  declare serviceIds: string[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  declare resourceIds?: string[];
}

// One parent/contact booking sequential, back-to-back turns for several
// patients (e.g. a pediatric dental checkup for 3 siblings) — each patient
// gets their own real time slot and their own Appointment row, never a
// shared slot, since the resource (dentist/chair) can only attend one
// patient at a time. See AppointmentsService.createGroup().
export class CreateAppointmentGroupDto {
  @IsString()
  declare contactId: string;

  @IsString()
  declare branchId: string;

  @IsString()
  declare startAt: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateAppointmentGroupPatientDto)
  declare patients: CreateAppointmentGroupPatientDto[];

  @IsString()
  @IsOptional()
  declare addressId?: string;

  @IsString()
  @IsOptional()
  declare notes?: string;

  // Internal-only, same pattern/rationale as CreateAppointmentDto.commerceSessionId.
  declare commerceSessionId?: string;
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

  @IsString()
  @IsOptional()
  declare groupId?: string;
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
