import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundError, ValidationError, zonedDateTimeToUtc, utcToZonedDateTime } from '@omniflow/utils';
import { EventsService } from '../events/events.service';
import { TenantContextService } from '../tenant-context/tenant-context.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ConfirmationImagesService } from '../confirmation-images/confirmation-images.service';
import {
  AvailabilityQueryDto,
  CreateAppointmentDto,
  CreateAppointmentGroupDto,
  RescheduleAppointmentDto,
  ListAppointmentsQueryDto,
  UpdateAppointmentStatusDto,
  CancelAppointmentDto,
} from './dto/appointment.dto';

// Which of appointment.confirmed/cancelled/completed/no_show
// (EVENTS_AND_WORKFLOWS.md's catalog) a transition into a given status
// corresponds to.
const APPOINTMENT_STATUS_EVENT: Record<string, string> = {
  CONFIRMED: 'appointment.confirmed',
  CANCELLED: 'appointment.cancelled',
  COMPLETED: 'appointment.completed',
  NO_SHOW: 'appointment.no_show',
};

// Interval math operates in minutes-of-day relative to the resource's
// BRANCH timezone (Branch.timezone) — converted to/from real UTC instants
// via zonedDateTimeToUtc/utcToZonedDateTime at the edges (slot generation,
// segment validation). UserSchedule has its own `timezone` field that is
// still not applied (staff personal schedules are assumed to share their
// branch's zone) — a narrower, still-open simplification than before.
type Interval = [number, number];

export function intersectIntervals(a: Interval[], b: Interval[]): Interval[] {
  const result: Interval[] = [];
  for (const [aStart, aEnd] of a) {
    for (const [bStart, bEnd] of b) {
      const start = Math.max(aStart, bStart);
      const end = Math.min(aEnd, bEnd);
      if (start < end) result.push([start, end]);
    }
  }
  return result;
}

export function subtractIntervals(base: Interval[], remove: Interval[]): Interval[] {
  let result = base;
  for (const [rStart, rEnd] of remove) {
    const next: Interval[] = [];
    for (const [s, e] of result) {
      if (rEnd <= s || rStart >= e) {
        next.push([s, e]);
        continue;
      }
      if (rStart > s) next.push([s, rStart]);
      if (rEnd < e) next.push([rEnd, e]);
    }
    result = next;
  }
  return result;
}

export function sliceIntoSlots(windows: Interval[], durationMinutes: number): Interval[] {
  const slots: Interval[] = [];
  for (const [start, end] of windows) {
    let cursor = start;
    while (cursor + durationMinutes <= end) {
      slots.push([cursor, cursor + durationMinutes]);
      cursor += durationMinutes;
    }
  }
  return slots;
}

const APPOINTMENT_INCLUDE = {
  contact: { select: { id: true, name: true } },
  branch: { select: { id: true, name: true, timezone: true } },
  address: true,
  services: true,
  resources: { include: { resource: { select: { id: true, name: true, type: true } } } },
};

const ACTIVE_STATUSES = ['PENDING', 'CONFIRMED'];

// CONFIRMED is the effective "just booked" state in AUTOMATIC approval mode
// (Tenant.appointmentApprovalMode, mirrors Order's orderApprovalMode) — in
// MANUAL mode create() starts the appointment at PENDING instead, requiring
// an operator to explicitly approve/reject it. COMPLETED replaces Order's
// DELIVERED semantically (the service was rendered).
const TRANSITIONS: Record<string, string[]> = {
  PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['COMPLETED', 'CANCELLED', 'NO_SHOW'],
  COMPLETED: [],
  CANCELLED: [],
  NO_SHOW: [],
};

function serializeAppointment(appt: any) {
  return {
    ...appt,
    subtotal: Number(appt.subtotal),
    total: Number(appt.total),
    services: appt.services?.map((s: any) => ({ ...s, priceSnapshot: Number(s.priceSnapshot) })),
  };
}

@Injectable()
export class AppointmentsService {
  constructor(
    private prisma: PrismaService,
    private eventsService: EventsService,
    private tenantContext: TenantContextService,
    private notificationsService: NotificationsService,
    private confirmationImagesService: ConfirmationImagesService,
  ) {}

  async list(query: ListAppointmentsQueryDto) {
    const appointments = await this.prisma.client.appointment.findMany({
      where: {
        ...(query.status && { status: query.status }),
        ...(query.branchId && { branchId: query.branchId }),
        ...(query.contactId && { contactId: query.contactId }),
        ...(query.groupId && { groupId: query.groupId }),
      },
      include: APPOINTMENT_INCLUDE,
      // Family/group bookings read naturally in turn order (earliest first);
      // the default unfiltered list stays newest-first.
      orderBy: { startAt: query.groupId ? 'asc' : 'desc' },
    });
    return appointments.map(serializeAppointment);
  }

  async findOne(id: string) {
    const appointment = await this.prisma.client.appointment.findUnique({
      where: { id },
      include: APPOINTMENT_INCLUDE,
    });
    if (!appointment) throw new NotFoundError('Appointment');
    return serializeAppointment(appointment);
  }

  async listStatusHistory(id: string) {
    await this.findOne(id);
    return this.prisma.client.appointmentStatusHistory.findMany({
      where: { appointmentId: id },
      orderBy: { createdAt: 'desc' },
    });
  }

  // Real availability for a STAFF resource = resource-schedule ∩
  // user-schedule − user-time-off − existing overlapping appointments.
  // Non-STAFF resources only use the resource-schedule layer.
  // `client` defaults to the tenant-scoped client but can be a $transaction
  // handle — create() re-runs this inside its transaction to close the
  // race window between the optimistic pre-check and the actual write.
  private async getResourceWindowsForDate(
    resource: any,
    dateStr: string,
    timeZone: string,
    excludeAppointmentId?: string,
    client: any = this.prisma.client,
  ): Promise<Interval[]> {
    // The calendar date itself (for the dayOfWeek lookup and the
    // BookingBlackoutDate key, a plain DATE column keyed by that literal
    // date, not a timezone-shifted instant) vs. the actual UTC instants
    // bounding that calendar day IN THE BRANCH'S ZONE (for comparing
    // against real timestamptz columns like Appointment.startAt).
    const calendarDay = new Date(`${dateStr}T00:00:00.000Z`);
    const dayOfWeek = calendarDay.getUTCDay();
    const localDayStart = zonedDateTimeToUtc(dateStr, 0, timeZone);
    const localDayEnd = zonedDateTimeToUtc(dateStr, 1440, timeZone);

    // A whole-team blackout (holiday/closure) for the resource's branch
    // blocks the entire day, regardless of resource type.
    const blackout = await client.bookingBlackoutDate.findUnique({
      where: { branchId_date: { branchId: resource.branchId, date: calendarDay } },
    });
    if (blackout) return [];

    const resourceSchedule = await client.bookingResourceSchedule.findMany({
      where: { resourceId: resource.id, dayOfWeek },
    });
    let windows: Interval[] = resourceSchedule.map((s: any) => [s.startMinute, s.endMinute]);

    if (resource.type === 'STAFF' && resource.userId) {
      const userSchedule = await client.userSchedule.findFirst({
        where: { userId: resource.userId, status: 'ACTIVE' },
        include: { intervals: { where: { dayOfWeek } } },
      });
      const userWindows: Interval[] = (userSchedule?.intervals ?? []).map((i: any) => [i.startMinute, i.endMinute]);
      windows = intersectIntervals(windows, userWindows);

      const timeOff = await client.userTimeOff.findMany({
        where: { userId: resource.userId, startAt: { lt: localDayEnd }, endAt: { gt: localDayStart } },
      });
      const timeOffMinutes: Interval[] = timeOff.map((t: any) => {
        const start = Math.max(0, Math.floor((t.startAt.getTime() - localDayStart.getTime()) / 60000));
        const end = Math.min(1440, Math.ceil((t.endAt.getTime() - localDayStart.getTime()) / 60000));
        return [start, end] as Interval;
      });
      windows = subtractIntervals(windows, timeOffMinutes);
    }

    const existingAppointmentLinks = await client.appointmentResource.findMany({
      where: {
        resourceId: resource.id,
        appointment: {
          status: { in: ACTIVE_STATUSES },
          startAt: { lt: localDayEnd },
          endAt: { gt: localDayStart },
          ...(excludeAppointmentId && { id: { not: excludeAppointmentId } }),
        },
      },
      include: { appointment: true },
    });
    const bookedMinutes: Interval[] = existingAppointmentLinks.map((link: any) => {
      const start = Math.max(0, Math.floor((link.appointment.startAt.getTime() - localDayStart.getTime()) / 60000));
      const end = Math.min(1440, Math.ceil((link.appointment.endAt.getTime() - localDayStart.getTime()) / 60000));
      return [start, end] as Interval;
    });

    return subtractIntervals(windows, bookedMinutes);
  }

  async getAvailability(query: AvailabilityQueryDto) {
    const service = await this.prisma.client.bookingService.findUnique({ where: { id: query.serviceId } });
    if (!service) throw new NotFoundError('BookingService');

    const branch = await this.prisma.client.branch.findUnique({ where: { id: query.branchId }, select: { timezone: true } });
    if (!branch) throw new NotFoundError('Branch');
    const timeZone = branch.timezone;

    const resources = await this.prisma.client.bookingResource.findMany({
      where: { branchId: query.branchId, status: 'ACTIVE', services: { some: { serviceId: query.serviceId } } },
    });

    const slotMap = new Map<number, Set<string>>();

    for (const resource of resources) {
      const windows = await this.getResourceWindowsForDate(resource, query.date, timeZone);
      const slots = sliceIntoSlots(windows, service.durationMinutes);
      for (const [start] of slots) {
        if (!slotMap.has(start)) slotMap.set(start, new Set());
        slotMap.get(start)!.add(resource.id);
      }
    }

    return Array.from(slotMap.entries())
      .sort(([a], [b]) => a - b)
      .map(([startMinute, resourceIds]) => {
        const startAt = zonedDateTimeToUtc(query.date, startMinute, timeZone);
        const endAt = new Date(startAt.getTime() + service.durationMinutes * 60000);
        return { startAt: startAt.toISOString(), endAt: endAt.toISOString(), resourceIds: Array.from(resourceIds) };
      });
  }

  // Services are booked as sequential back-to-back segments starting at
  // dto.startAt (service[0] occupies [startAt, startAt+dur0), service[1]
  // occupies [startAt+dur0, startAt+dur0+dur1), ...), each with its own
  // resource — a multi-service visit (e.g. see one specialist then another).
  async create(dto: CreateAppointmentDto) {
    if (!dto.serviceIds.length) throw new ValidationError('At least one serviceId is required');

    const services = await this.prisma.client.bookingService.findMany({ where: { id: { in: dto.serviceIds } } });
    if (services.length !== dto.serviceIds.length) throw new ValidationError('One or more services do not exist');

    if (dto.resourceIds && dto.resourceIds.length !== dto.serviceIds.length) {
      throw new ValidationError('resourceIds must have the same length as serviceIds when provided');
    }

    const branch = await this.prisma.client.branch.findUnique({ where: { id: dto.branchId }, select: { timezone: true } });
    if (!branch) throw new ValidationError('Branch not found');
    const timeZone = branch.timezone;

    let cursor = new Date(dto.startAt);
    const segments: { service: any; resourceId?: string; startAt: Date; endAt: Date }[] = [];
    for (let i = 0; i < dto.serviceIds.length; i++) {
      const service = services.find((s: any) => s.id === dto.serviceIds[i]);
      const startAt = new Date(cursor);
      const endAt = new Date(cursor.getTime() + service.durationMinutes * 60000);
      segments.push({ service, resourceId: dto.resourceIds?.[i], startAt, endAt });
      cursor = endAt;
    }

    for (const segment of segments) {
      const { dateStr, minutes: segStartMinute } = utcToZonedDateTime(segment.startAt, timeZone);
      const segEndMinute = segStartMinute + Math.round((segment.endAt.getTime() - segment.startAt.getTime()) / 60000);

      const candidateResources = segment.resourceId
        ? await this.prisma.client.bookingResource.findMany({
            where: { id: segment.resourceId, branchId: dto.branchId, services: { some: { serviceId: segment.service.id } } },
          })
        : await this.prisma.client.bookingResource.findMany({
            where: { branchId: dto.branchId, status: 'ACTIVE', services: { some: { serviceId: segment.service.id } } },
          });

      let assigned: any = null;
      for (const candidate of candidateResources) {
        const windows = await this.getResourceWindowsForDate(candidate, dateStr, timeZone);
        const fits = windows.some(([s, e]) => s <= segStartMinute && e >= segEndMinute);
        if (fits) {
          assigned = candidate;
          break;
        }
      }
      if (!assigned) {
        throw new ValidationError(`No available resource for service "${segment.service.name}" at the requested time`);
      }
      segment.resourceId = assigned.id;
    }

    const firstStart = segments[0].startAt;
    const lastEnd = segments[segments.length - 1].endAt;
    const subtotal = services.reduce((sum: number, s: any) => sum + Number(s.price), 0);

    const tenantId = this.tenantContext.getTenantId();
    const tenant = tenantId
      ? await this.prisma.client.tenant.findUnique({
          where: { id: tenantId },
          select: {
            name: true,
            appointmentApprovalMode: true,
            notifyOnAppointmentPendingApproval: true,
            sendAppointmentQrCode: true,
            sendAppointmentReceiptImage: true,
          },
        })
      : null;
    const requiresManualApproval = tenant?.appointmentApprovalMode === 'MANUAL';

    const appointment = await this.prisma.client.$transaction(async (tx: any) => {
      // Re-verify each segment's assigned resource is still free, inside the
      // transaction — the pre-check above ran outside it, so a concurrent
      // booking for the same slot could otherwise slip through between the
      // check and this write. Public, anonymous traffic makes this a real
      // risk, not just a theoretical one.
      for (const segment of segments) {
        const { dateStr, minutes: segStartMinute } = utcToZonedDateTime(segment.startAt, timeZone);
        const segEndMinute = segStartMinute + Math.round((segment.endAt.getTime() - segment.startAt.getTime()) / 60000);
        const resource = await tx.bookingResource.findUnique({ where: { id: segment.resourceId } });
        const windows = await this.getResourceWindowsForDate(resource, dateStr, timeZone, undefined, tx);
        const stillFits = windows.some(([s, e]) => s <= segStartMinute && e >= segEndMinute);
        if (!stillFits) {
          throw new ValidationError(`Ese horario ya no está disponible para "${segment.service.name}", elige otro.`);
        }
      }

      const created = await tx.appointment.create({
        data: {
          contactId: dto.contactId,
          branchId: dto.branchId,
          addressId: dto.addressId,
          commerceSessionId: dto.commerceSessionId,
          patientName: dto.patientName,
          groupId: dto.groupId,
          notes: dto.notes,
          startAt: firstStart,
          endAt: lastEnd,
          subtotal,
          total: subtotal,
          currency: 'BOB',
          status: requiresManualApproval ? 'PENDING' : 'CONFIRMED',
          confirmedAt: requiresManualApproval ? null : new Date(),
        },
      });

      await tx.appointmentService.createMany({
        data: segments.map((seg) => ({
          appointmentId: created.id,
          serviceId: seg.service.id,
          serviceNameSnapshot: seg.service.name,
          priceSnapshot: seg.service.price,
          durationMinutesSnapshot: seg.service.durationMinutes,
        })),
      });

      const uniqueResourceIds = Array.from(new Set(segments.map((s) => s.resourceId)));
      await tx.appointmentResource.createMany({
        data: uniqueResourceIds.map((resourceId) => ({ appointmentId: created.id, resourceId })),
      });

      return tx.appointment.findUnique({ where: { id: created.id }, include: APPOINTMENT_INCLUDE });
    });

    await this.eventsService.emit(
      'appointment.created',
      { appointmentId: appointment.id, startAt: appointment.startAt },
      appointment.contactId,
    );

    if (
      !dto.skipConfirmationImages &&
      tenantId &&
      dto.commerceSessionId &&
      (tenant?.sendAppointmentQrCode || tenant?.sendAppointmentReceiptImage)
    ) {
      await this.sendConfirmationImages(tenantId, dto.commerceSessionId, appointment, tenant, timeZone);
    }

    if (requiresManualApproval) {
      await this.eventsService.emit(
        'appointment.pending_approval',
        { appointmentId: appointment.id, startAt: appointment.startAt },
        appointment.contactId,
      );
      if (tenant?.notifyOnAppointmentPendingApproval) {
        await this.notificationsService.create({
          type: 'appointment.pending_approval',
          title: 'Nueva cita pendiente de aprobación',
          body: new Date(appointment.startAt).toLocaleString('es-BO', { timeZone, dateStyle: 'medium', timeStyle: 'short' }),
          link: '/dashboard/booking',
        });
      }
    } else if (tenant?.notifyOnAppointmentConfirmed) {
      await this.notificationsService.create({
        type: 'appointment.confirmed',
        title: 'Nueva cita confirmada',
        body: new Date(appointment.startAt).toLocaleString('es-BO', { timeZone, dateStyle: 'medium', timeStyle: 'short' }),
        link: '/dashboard/booking',
      });
    }

    return serializeAppointment(appointment);
  }

  // One parent/contact booking sequential turns for several patients (e.g. a
  // pediatric dental checkup for 3 siblings) — each patient gets their own
  // real Appointment, one right after another on whichever resource create()
  // finds available for them (not necessarily the same one), never a shared
  // slot. Each create() call has its own full validation/transaction/retry
  // safety already; this only sequences them and, if any patient can't be
  // fit, cancels the ones already booked rather than leaving a half-built
  // family booking active — the customer sees one clear failure, not a
  // confusing partial success.
  async createGroup(dto: CreateAppointmentGroupDto) {
    const groupId = randomUUID();
    const created: any[] = [];
    let cursor = dto.startAt;

    try {
      for (const patient of dto.patients) {
        const appointment = await this.create({
          contactId: dto.contactId,
          branchId: dto.branchId,
          serviceIds: patient.serviceIds,
          resourceIds: patient.resourceIds,
          startAt: cursor,
          addressId: dto.addressId,
          notes: dto.notes,
          commerceSessionId: dto.commerceSessionId,
          patientName: patient.patientName,
          groupId,
          skipConfirmationImages: true,
        } as any);
        created.push(appointment);
        cursor = new Date(appointment.endAt).toISOString();
      }
    } catch (error) {
      for (const appointment of created) {
        await this.cancel(appointment.id, undefined as any, {
          note: 'Reserva familiar incompleta: un horario dejó de estar disponible',
        }).catch(() => undefined);
      }
      throw error;
    }

    const tenantId = this.tenantContext.getTenantId();
    if (tenantId && dto.commerceSessionId) {
      const tenant = await this.prisma.client.tenant.findUnique({
        where: { id: tenantId },
        select: { name: true, sendAppointmentQrCode: true, sendAppointmentReceiptImage: true },
      });
      if (tenant?.sendAppointmentQrCode || tenant?.sendAppointmentReceiptImage) {
        await this.sendGroupConfirmationImages(tenantId, dto.commerceSessionId, created, tenant);
      }
    }

    return created;
  }

  private async sendGroupConfirmationImages(tenantId: string, commerceSessionId: string, appointments: any[], tenant: any) {
    const session = await this.prisma.client.commerceSession.findUnique({
      where: { id: commerceSessionId },
      select: { conversationId: true },
    });
    if (!session?.conversationId) return;

    const branch = await this.prisma.client.branch.findUnique({ where: { id: appointments[0].branchId }, select: { timezone: true, name: true } });
    const timeZone = branch?.timezone ?? 'UTC';
    const formatWhen = (d: any) => new Date(d).toLocaleString('es-BO', { timeZone, dateStyle: 'medium', timeStyle: 'short' });

    const qrText = [
      'Reserva familiar confirmada',
      `N°: ${appointments[0].id}`,
      ...appointments.map((a) => `${a.patientName ?? 'Paciente'}: ${formatWhen(a.startAt)}`),
      `Sucursal: ${branch?.name ?? ''}`,
    ].join('\n');

    const currency = appointments[0].currency;
    const total = appointments.reduce((sum, a) => sum + Number(a.total), 0);

    await this.confirmationImagesService.send({
      tenantId,
      conversationId: session.conversationId,
      sendQrCode: !!tenant?.sendAppointmentQrCode,
      sendReceiptImage: !!tenant?.sendAppointmentReceiptImage,
      qrText,
      receipt: {
        businessName: tenant?.name ?? '',
        title: 'Reserva familiar confirmada',
        subtitle: `${appointments.length} paciente(s)`,
        lines: appointments.map((a) => ({
          label: `${a.patientName ?? 'Paciente'} — ${formatWhen(a.startAt)}`,
          value: `${a.currency} ${Number(a.total).toFixed(2)}`,
        })),
        totalLabel: 'Total',
        totalValue: `${currency} ${total.toFixed(2)}`,
        footer: '¡Los esperamos!',
      },
    });
  }

  private async sendConfirmationImages(tenantId: string, commerceSessionId: string, appointment: any, tenant: any, timeZone: string) {
    const session = await this.prisma.client.commerceSession.findUnique({
      where: { id: commerceSessionId },
      select: { conversationId: true },
    });
    if (!session?.conversationId) return;

    const when = new Date(appointment.startAt).toLocaleString('es-BO', { timeZone, dateStyle: 'medium', timeStyle: 'short' });
    const serviceNames = appointment.services.map((s: any) => s.serviceNameSnapshot).join(', ');

    const qrText = [
      'Cita confirmada',
      `N°: ${appointment.id}`,
      `Cliente: ${appointment.contact?.name ?? ''}`,
      `Servicio: ${serviceNames}`,
      `Fecha: ${when}`,
      `Sucursal: ${appointment.branch?.name ?? ''}`,
    ].join('\n');

    await this.confirmationImagesService.send({
      tenantId,
      conversationId: session.conversationId,
      sendQrCode: !!tenant?.sendAppointmentQrCode,
      sendReceiptImage: !!tenant?.sendAppointmentReceiptImage,
      qrText,
      receipt: {
        businessName: tenant?.name ?? '',
        title: 'Cita confirmada',
        subtitle: when,
        lines: appointment.services.map((s: any) => ({
          label: `${s.serviceNameSnapshot} (${s.durationMinutesSnapshot} min)`,
          value: `${appointment.currency} ${Number(s.priceSnapshot).toFixed(2)}`,
        })),
        totalLabel: 'Total',
        totalValue: `${appointment.currency} ${Number(appointment.total).toFixed(2)}`,
        footer: '¡Te esperamos!',
      },
    });
  }

  async reschedule(id: string, dto: RescheduleAppointmentDto) {
    const appointment = await this.findOne(id);
    if (appointment.status !== 'PENDING' && appointment.status !== 'CONFIRMED') {
      throw new ValidationError('Only a PENDING/CONFIRMED appointment can be rescheduled');
    }

    const newStartAt = dto.startAt ? new Date(dto.startAt) : new Date(appointment.startAt);
    const newEndAt = dto.endAt ? new Date(dto.endAt) : new Date(appointment.endAt);
    const resourceIds: string[] = dto.resourceIds ?? appointment.resources.map((r: any) => r.resourceId);

    const branch = await this.prisma.client.branch.findUnique({ where: { id: appointment.branchId }, select: { timezone: true } });
    const timeZone = branch?.timezone ?? 'UTC';
    const { dateStr, minutes: startMinute } = utcToZonedDateTime(newStartAt, timeZone);
    const endMinute = startMinute + Math.round((newEndAt.getTime() - newStartAt.getTime()) / 60000);

    for (const resourceId of resourceIds) {
      const resource = await this.prisma.client.bookingResource.findUnique({ where: { id: resourceId } });
      if (!resource) throw new NotFoundError('BookingResource');
      const windows = await this.getResourceWindowsForDate(resource, dateStr, timeZone, id);
      const fits = windows.some(([s, e]) => s <= startMinute && e >= endMinute);
      if (!fits) throw new ValidationError('The selected resource is not available for the new time');
    }

    await this.prisma.client.$transaction(async (tx: any) => {
      await tx.appointment.update({
        where: { id },
        data: { startAt: newStartAt, endAt: newEndAt, ...(dto.notes !== undefined && { notes: dto.notes }) },
      });
      if (dto.resourceIds) {
        await tx.appointmentResource.deleteMany({ where: { appointmentId: id } });
        await tx.appointmentResource.createMany({
          data: resourceIds.map((resourceId: string) => ({ appointmentId: id, resourceId })),
        });
      }
    });

    return this.findOne(id);
  }

  async cancel(id: string, actorUserId: string, dto: CancelAppointmentDto) {
    return this.transition(id, 'CANCELLED', actorUserId, dto.note);
  }

  async setStatus(id: string, actorUserId: string, dto: UpdateAppointmentStatusDto) {
    return this.transition(id, dto.status, actorUserId, dto.note);
  }

  private async transition(id: string, toStatus: string, actorUserId: string | undefined, note: string | undefined) {
    const appointment = await this.findOne(id);
    const allowed = TRANSITIONS[appointment.status] ?? [];
    if (!allowed.includes(toStatus)) {
      throw new ValidationError(`Cannot transition an appointment from ${appointment.status} to ${toStatus}`);
    }

    await this.prisma.client.$transaction(async (tx: any) => {
      await tx.appointment.update({
        where: { id },
        data: {
          status: toStatus,
          ...(toStatus === 'CONFIRMED' && { confirmedAt: new Date() }),
        },
      });
      await tx.appointmentStatusHistory.create({
        data: { appointmentId: id, fromStatus: appointment.status, toStatus, note, changedByUserId: actorUserId },
      });
    });

    const eventType = APPOINTMENT_STATUS_EVENT[toStatus];
    if (eventType) {
      await this.eventsService.emit(
        eventType,
        { appointmentId: id, fromStatus: appointment.status, toStatus },
        appointment.contactId,
      );
    }

    return this.findOne(id);
  }
}
