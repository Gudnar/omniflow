import { Injectable } from '@nestjs/common';
import { ValidationError } from '@omniflow/utils';
import { PrismaService } from '../prisma/prisma.service';
import { StorefrontService } from './storefront.service';
import { AppointmentsService } from '../booking/appointments.service';
import { BookingServicesService } from '../booking/booking-services.service';
import { PublicAvailabilityQueryDto, PublicBookAppointmentDto } from './dto/public-booking.dto';

// Public booking surface for the same storefront/session token used by the
// ecommerce flow (StorefrontService) — a tenant with operationMode BOOKING
// or BOTH shows this instead of, or alongside, the product catalog. Reuses
// AppointmentsService/BookingServicesService unmodified; the only new
// behavior here is (a) resolving contactId/branchId from the session token
// instead of trusting client input, and (b) enforcing the branch's
// minBookingLeadDays, which is a public-flow-only guardrail — an operator
// creating an appointment from the admin keeps full same-day flexibility.
@Injectable()
export class BookingStorefrontService {
  constructor(
    private prisma: PrismaService,
    private storefrontService: StorefrontService,
    private appointmentsService: AppointmentsService,
    private bookingServicesService: BookingServicesService,
  ) {}

  async listServices(slug: string) {
    await this.storefrontService.resolveStoreBySlug(slug);
    const services = await this.bookingServicesService.list();
    return services.filter((s: any) => s.status === 'ACTIVE');
  }

  private async requireSessionBranch(token: string) {
    const session = await this.storefrontService.resolveSessionByToken(token);
    if (!session.branchId) {
      throw new ValidationError('This session has no branch selected yet — cannot check booking availability');
    }
    const branch = await this.prisma.client.branch.findUnique({ where: { id: session.branchId } });
    return { session, branch };
  }

  private earliestBookableDate(minBookingLeadDays: number): string {
    const today = new Date();
    const earliest = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
    earliest.setUTCDate(earliest.getUTCDate() + minBookingLeadDays);
    return earliest.toISOString().slice(0, 10);
  }

  async getAvailability(token: string, query: PublicAvailabilityQueryDto) {
    const { session, branch } = await this.requireSessionBranch(token);
    if (query.date < this.earliestBookableDate(branch.minBookingLeadDays)) {
      return [];
    }
    return this.appointmentsService.getAvailability({
      serviceId: query.serviceId,
      branchId: session.branchId!,
      date: query.date,
    });
  }

  // Bundled with minBookingLeadDays so the public calendar can render a
  // whole month's enabled/disabled days from one call instead of probing
  // availability day-by-day.
  async listBlackoutDates(token: string) {
    const { session, branch } = await this.requireSessionBranch(token);
    const rows = await this.prisma.client.bookingBlackoutDate.findMany({
      where: { branchId: session.branchId! },
      orderBy: { date: 'asc' },
    });
    return {
      minBookingLeadDays: branch.minBookingLeadDays,
      timezone: branch.timezone,
      dates: rows.map((r: any) => r.date.toISOString().slice(0, 10)),
    };
  }

  async bookAppointment(token: string, dto: PublicBookAppointmentDto) {
    const { session, branch } = await this.requireSessionBranch(token);
    const dateStr = dto.startAt.slice(0, 10);
    if (dateStr < this.earliestBookableDate(branch.minBookingLeadDays)) {
      throw new ValidationError(`Debes reservar con al menos ${branch.minBookingLeadDays} día(s) de anticipación`);
    }

    return this.appointmentsService.create({
      contactId: session.contactId,
      branchId: session.branchId!,
      serviceIds: [dto.serviceId],
      startAt: dto.startAt,
    } as any);
  }
}
