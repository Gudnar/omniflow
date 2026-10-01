import { IsString } from 'class-validator';

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
