import { IsString, IsArray, ArrayMinSize, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

// Deliberately narrower than AvailabilityQueryDto/CreateAppointmentDto —
// branchId/contactId must never come from an anonymous client, they're
// always resolved from the session's own token (see BookingStorefrontService).
export class PublicAvailabilityQueryDto {
  @IsString()
  declare serviceId: string;

  @IsString()
  declare date: string;
}

export class PublicBookAppointmentDto {
  @IsString()
  declare serviceId: string;

  @IsString()
  declare startAt: string;
}

export class PublicAppointmentGroupPatientDto {
  @IsString()
  declare patientName: string;

  @IsString()
  declare serviceId: string;
}

// For a single booking contact reserving sequential, back-to-back turns for
// several patients (e.g. a parent booking a pediatric checkup for each of
// their children) — see AppointmentsService.createGroup().
export class PublicBookAppointmentGroupDto {
  @IsString()
  declare startAt: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PublicAppointmentGroupPatientDto)
  declare patients: PublicAppointmentGroupPatientDto[];
}
