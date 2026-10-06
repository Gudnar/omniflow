import {
  AppointmentsService,
  intersectIntervals,
  subtractIntervals,
  sliceIntoSlots,
} from './appointments.service';
import { NotFoundError, ValidationError } from '@omniflow/utils';

describe('interval math helpers', () => {
  it('intersectIntervals returns only overlapping ranges', () => {
    expect(intersectIntervals([[540, 1080]], [[600, 1020]])).toEqual([[600, 1020]]);
    expect(intersectIntervals([[540, 600]], [[700, 800]])).toEqual([]);
  });

  it('subtractIntervals removes a fully-contained range, splitting the window', () => {
    expect(subtractIntervals([[540, 1080]], [[700, 800]])).toEqual([
      [540, 700],
      [800, 1080],
    ]);
  });

  it('subtractIntervals removes an edge-overlapping range without leaving an empty sliver', () => {
    expect(subtractIntervals([[540, 1080]], [[1000, 1200]])).toEqual([[540, 1000]]);
    expect(subtractIntervals([[540, 1080]], [[0, 600]])).toEqual([[600, 1080]]);
  });

  it('sliceIntoSlots produces back-to-back non-overlapping slots sized to duration', () => {
    expect(sliceIntoSlots([[540, 630]], 30)).toEqual([
      [540, 570],
      [570, 600],
      [600, 630],
    ]);
  });

  it('sliceIntoSlots drops a trailing remainder shorter than one full slot', () => {
    expect(sliceIntoSlots([[540, 590]], 30)).toEqual([[540, 570]]);
  });
});

describe('AppointmentsService', () => {
  let service: AppointmentsService;
  let prisma: any;
  let tx: any;
  let eventsService: any;
  let tenantContext: any;
  let notificationsService: any;
  let confirmationImagesService: any;

  beforeEach(() => {
    const bookingResourceSchedule = { findMany: jest.fn() };
    const userSchedule = { findFirst: jest.fn() };
    const userTimeOff = { findMany: jest.fn() };
    const bookingBlackoutDate = { findUnique: jest.fn().mockResolvedValue(null) };
    const appointmentResourceFindMany = jest.fn().mockResolvedValue([]);
    const bookingResource = { findMany: jest.fn(), findUnique: jest.fn() };
    const branch = { findUnique: jest.fn().mockResolvedValue({ timezone: 'UTC' }) };

    // create()'s in-transaction re-check calls these same read-only tables
    // again through `tx` — sharing the mock functions with the outer
    // `prisma.client` ones means a test's mockResolvedValue on one applies
    // to both call sites, matching how the real tenant-scoped client and a
    // $transaction handle read the same underlying tables.
    tx = {
      appointment: { create: jest.fn(), update: jest.fn(), findUnique: jest.fn() },
      appointmentService: { createMany: jest.fn() },
      appointmentResource: { findMany: appointmentResourceFindMany, createMany: jest.fn(), deleteMany: jest.fn() },
      appointmentStatusHistory: { create: jest.fn() },
      bookingResource,
      bookingResourceSchedule,
      userSchedule,
      userTimeOff,
      bookingBlackoutDate,
    };
    prisma = {
      client: {
        appointment: { findMany: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
        appointmentStatusHistory: { findMany: jest.fn() },
        bookingService: { findUnique: jest.fn(), findMany: jest.fn() },
        bookingResource,
        bookingResourceSchedule,
        userSchedule,
        userTimeOff,
        bookingBlackoutDate,
        branch,
        appointmentResource: { findMany: appointmentResourceFindMany },
        commerceSession: { findUnique: jest.fn().mockResolvedValue(null) },
        tenant: {
          findUnique: jest
            .fn()
            .mockResolvedValue({ appointmentApprovalMode: 'AUTOMATIC', notifyOnAppointmentPendingApproval: true }),
        },
        $transaction: jest.fn((cb: any) => cb(tx)),
      },
    };
    eventsService = { emit: jest.fn() };
    tenantContext = { getTenantId: jest.fn().mockReturnValue('t1') };
    notificationsService = { create: jest.fn() };
    confirmationImagesService = { send: jest.fn() };
    service = new AppointmentsService(prisma, eventsService, tenantContext, notificationsService, confirmationImagesService);
  });

  describe('getAvailability', () => {
    it('throws NotFoundError when the service does not exist', async () => {
      prisma.client.bookingService.findUnique.mockResolvedValue(null);
      await expect(service.getAvailability({ serviceId: 's1', branchId: 'b1', date: '2026-01-05' } as any)).rejects.toThrow(
        NotFoundError,
      );
    });

    it('returns slots for a non-STAFF resource using only the resource schedule', async () => {
      prisma.client.bookingService.findUnique.mockResolvedValue({ id: 's1', durationMinutes: 60 });
      prisma.client.bookingResource.findMany.mockResolvedValue([{ id: 'r1', type: 'ROOM', userId: null }]);
      // A single 60-minute-wide window fits exactly one slot.
      prisma.client.bookingResourceSchedule.findMany.mockResolvedValue([{ startMinute: 540, endMinute: 600 }]);
      prisma.client.appointmentResource.findMany.mockResolvedValue([]);

      const slots = await service.getAvailability({ serviceId: 's1', branchId: 'b1', date: '2026-01-05' } as any);

      expect(prisma.client.userSchedule.findFirst).not.toHaveBeenCalled();
      expect(slots).toEqual([
        { startAt: '2026-01-05T09:00:00.000Z', endAt: '2026-01-05T10:00:00.000Z', resourceIds: ['r1'] },
      ]);
    });

    it('intersects with the user schedule and excludes a time-off window for a STAFF resource', async () => {
      prisma.client.bookingService.findUnique.mockResolvedValue({ id: 's1', durationMinutes: 60 });
      prisma.client.bookingResource.findMany.mockResolvedValue([{ id: 'r1', type: 'STAFF', userId: 'u1' }]);
      // Resource open 09:00-18:00, user only works 09:00-11:00 that day.
      prisma.client.bookingResourceSchedule.findMany.mockResolvedValue([{ startMinute: 540, endMinute: 1080 }]);
      prisma.client.userSchedule.findFirst.mockResolvedValue({
        intervals: [{ dayOfWeek: 1, startMinute: 540, endMinute: 660 }],
      });
      prisma.client.userTimeOff.findMany.mockResolvedValue([
        { startAt: new Date('2026-01-05T09:30:00.000Z'), endAt: new Date('2026-01-05T10:00:00.000Z') },
      ]);
      prisma.client.appointmentResource.findMany.mockResolvedValue([]);

      const slots = await service.getAvailability({ serviceId: 's1', branchId: 'b1', date: '2026-01-05' } as any);

      // Only 10:00-11:00 remains free for a 60-minute slot after time-off cuts 09:30-10:00.
      expect(slots).toEqual([
        { startAt: '2026-01-05T10:00:00.000Z', endAt: '2026-01-05T11:00:00.000Z', resourceIds: ['r1'] },
      ]);
    });

    it('returns no slots at all on a branch-wide blackout date, even for a resource with an open schedule', async () => {
      prisma.client.bookingService.findUnique.mockResolvedValue({ id: 's1', durationMinutes: 60 });
      prisma.client.bookingResource.findMany.mockResolvedValue([{ id: 'r1', type: 'ROOM', userId: null, branchId: 'b1' }]);
      prisma.client.bookingResourceSchedule.findMany.mockResolvedValue([{ startMinute: 0, endMinute: 1440 }]);
      prisma.client.bookingBlackoutDate.findUnique.mockResolvedValue({ id: 'bo1', branchId: 'b1', date: new Date('2026-01-05') });

      const slots = await service.getAvailability({ serviceId: 's1', branchId: 'b1', date: '2026-01-05' } as any);

      expect(slots).toEqual([]);
      expect(prisma.client.bookingResourceSchedule.findMany).not.toHaveBeenCalled();
    });

    it('excludes a slot already covered by an existing appointment', async () => {
      prisma.client.bookingService.findUnique.mockResolvedValue({ id: 's1', durationMinutes: 60 });
      prisma.client.bookingResource.findMany.mockResolvedValue([{ id: 'r1', type: 'ROOM', userId: null }]);
      // Window exactly matches the existing appointment, so nothing remains.
      prisma.client.bookingResourceSchedule.findMany.mockResolvedValue([{ startMinute: 540, endMinute: 600 }]);
      prisma.client.appointmentResource.findMany.mockResolvedValue([
        {
          appointment: { startAt: new Date('2026-01-05T09:00:00.000Z'), endAt: new Date('2026-01-05T10:00:00.000Z') },
        },
      ]);

      const slots = await service.getAvailability({ serviceId: 's1', branchId: 'b1', date: '2026-01-05' } as any);
      expect(slots).toEqual([]);
    });

    it('converts a schedule entered as branch-local wall-clock minutes into the correct UTC instant', async () => {
      // America/La_Paz is a fixed UTC-4, no DST — a 10:30 local slot must be
      // returned as 14:30Z, not 10:30Z (the bug this test guards against).
      prisma.client.branch.findUnique.mockResolvedValue({ timezone: 'America/La_Paz' });
      prisma.client.bookingService.findUnique.mockResolvedValue({ id: 's1', durationMinutes: 60 });
      prisma.client.bookingResource.findMany.mockResolvedValue([{ id: 'r1', type: 'ROOM', userId: null }]);
      prisma.client.bookingResourceSchedule.findMany.mockResolvedValue([{ startMinute: 630, endMinute: 690 }]);
      prisma.client.appointmentResource.findMany.mockResolvedValue([]);

      const slots = await service.getAvailability({ serviceId: 's1', branchId: 'b1', date: '2026-01-05' } as any);

      expect(slots).toEqual([
        { startAt: '2026-01-05T14:30:00.000Z', endAt: '2026-01-05T15:30:00.000Z', resourceIds: ['r1'] },
      ]);
    });
  });

  describe('create', () => {
    it('rejects when a service does not exist', async () => {
      prisma.client.bookingService.findMany.mockResolvedValue([]);
      await expect(
        service.create({ contactId: 'c1', branchId: 'b1', serviceIds: ['missing'], startAt: '2026-01-05T09:00:00.000Z' } as any),
      ).rejects.toThrow(ValidationError);
    });

    it('rejects a resourceIds/serviceIds length mismatch', async () => {
      prisma.client.bookingService.findMany.mockResolvedValue([{ id: 's1', durationMinutes: 60, price: '50', name: 'Corte' }]);
      await expect(
        service.create({
          contactId: 'c1',
          branchId: 'b1',
          serviceIds: ['s1'],
          startAt: '2026-01-05T09:00:00.000Z',
          resourceIds: ['r1', 'r2'],
        } as any),
      ).rejects.toThrow(ValidationError);
    });

    it('rejects when no resource is available at the requested time', async () => {
      prisma.client.bookingService.findMany.mockResolvedValue([{ id: 's1', durationMinutes: 60, price: '50', name: 'Corte' }]);
      prisma.client.bookingResource.findMany.mockResolvedValue([]);

      await expect(
        service.create({ contactId: 'c1', branchId: 'b1', serviceIds: ['s1'], startAt: '2026-01-05T09:00:00.000Z' } as any),
      ).rejects.toThrow(ValidationError);
      expect(prisma.client.$transaction).not.toHaveBeenCalled();
    });

    it('creates an appointment, snapshotting service price/name/duration and linking the assigned resource', async () => {
      const resource = { id: 'r1', type: 'ROOM', userId: null, branchId: 'b1' };
      prisma.client.bookingService.findMany.mockResolvedValue([{ id: 's1', durationMinutes: 60, price: '50', name: 'Corte' }]);
      prisma.client.bookingResource.findMany.mockResolvedValue([resource]);
      // The in-transaction re-check looks the assigned resource up again by id.
      prisma.client.bookingResource.findUnique.mockResolvedValue(resource);
      prisma.client.bookingResourceSchedule.findMany.mockResolvedValue([{ startMinute: 0, endMinute: 1440 }]);
      prisma.client.appointmentResource.findMany.mockResolvedValue([]);
      tx.appointment.create.mockResolvedValue({ id: 'a1' });
      tx.appointment.findUnique.mockResolvedValue({
        id: 'a1',
        contactId: 'c1',
        startAt: '2026-01-05T09:00:00.000Z',
        subtotal: '50',
        total: '50',
        services: [],
      });

      await service.create({ contactId: 'c1', branchId: 'b1', serviceIds: ['s1'], startAt: '2026-01-05T09:00:00.000Z' } as any);

      expect(tx.appointment.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ contactId: 'c1', branchId: 'b1', subtotal: 50, total: 50, currency: 'BOB' }),
      });
      expect(tx.appointmentService.createMany).toHaveBeenCalledWith({
        data: [
          expect.objectContaining({
            appointmentId: 'a1',
            serviceId: 's1',
            serviceNameSnapshot: 'Corte',
            priceSnapshot: '50',
            durationMinutesSnapshot: 60,
          }),
        ],
      });
      expect(tx.appointmentResource.createMany).toHaveBeenCalledWith({ data: [{ appointmentId: 'a1', resourceId: 'r1' }] });
      expect(eventsService.emit).toHaveBeenCalledWith(
        'appointment.created',
        { appointmentId: 'a1', startAt: '2026-01-05T09:00:00.000Z' },
        'c1',
      );
    });

    it('sends confirmation images when a commerceSessionId is given and the tenant has them enabled', async () => {
      const resource = { id: 'r1', type: 'ROOM', userId: null, branchId: 'b1' };
      prisma.client.bookingService.findMany.mockResolvedValue([{ id: 's1', durationMinutes: 60, price: '50', name: 'Corte' }]);
      prisma.client.bookingResource.findMany.mockResolvedValue([resource]);
      prisma.client.bookingResource.findUnique.mockResolvedValue(resource);
      prisma.client.bookingResourceSchedule.findMany.mockResolvedValue([{ startMinute: 0, endMinute: 1440 }]);
      prisma.client.appointmentResource.findMany.mockResolvedValue([]);
      prisma.client.tenant.findUnique.mockResolvedValue({
        name: 'Demo Co',
        appointmentApprovalMode: 'AUTOMATIC',
        notifyOnAppointmentPendingApproval: true,
        sendAppointmentQrCode: true,
        sendAppointmentReceiptImage: true,
      });
      prisma.client.commerceSession.findUnique.mockResolvedValue({ conversationId: 'conv1' });
      tx.appointment.create.mockResolvedValue({ id: 'a1' });
      tx.appointment.findUnique.mockResolvedValue({
        id: 'a1',
        contactId: 'c1',
        contact: { name: 'Juan' },
        branch: { name: 'Sucursal Centro' },
        currency: 'BOB',
        startAt: '2026-01-05T09:00:00.000Z',
        subtotal: '50',
        total: '50',
        services: [{ serviceNameSnapshot: 'Corte', durationMinutesSnapshot: 60, priceSnapshot: '50' }],
      });

      await service.create({
        contactId: 'c1',
        branchId: 'b1',
        serviceIds: ['s1'],
        startAt: '2026-01-05T09:00:00.000Z',
        commerceSessionId: 'sess1',
      } as any);

      expect(prisma.client.commerceSession.findUnique).toHaveBeenCalledWith({
        where: { id: 'sess1' },
        select: { conversationId: true },
      });
      expect(confirmationImagesService.send).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: 't1',
          conversationId: 'conv1',
          sendQrCode: true,
          sendReceiptImage: true,
        }),
      );
    });

    it('skips confirmation images when no commerceSessionId is given', async () => {
      const resource = { id: 'r1', type: 'ROOM', userId: null, branchId: 'b1' };
      prisma.client.bookingService.findMany.mockResolvedValue([{ id: 's1', durationMinutes: 60, price: '50', name: 'Corte' }]);
      prisma.client.bookingResource.findMany.mockResolvedValue([resource]);
      prisma.client.bookingResource.findUnique.mockResolvedValue(resource);
      prisma.client.bookingResourceSchedule.findMany.mockResolvedValue([{ startMinute: 0, endMinute: 1440 }]);
      prisma.client.appointmentResource.findMany.mockResolvedValue([]);
      prisma.client.tenant.findUnique.mockResolvedValue({
        appointmentApprovalMode: 'AUTOMATIC',
        notifyOnAppointmentPendingApproval: true,
        sendAppointmentQrCode: true,
        sendAppointmentReceiptImage: true,
      });
      tx.appointment.create.mockResolvedValue({ id: 'a1' });
      tx.appointment.findUnique.mockResolvedValue({
        id: 'a1',
        contactId: 'c1',
        startAt: '2026-01-05T09:00:00.000Z',
        subtotal: '50',
        total: '50',
        services: [],
      });

      await service.create({ contactId: 'c1', branchId: 'b1', serviceIds: ['s1'], startAt: '2026-01-05T09:00:00.000Z' } as any);

      expect(confirmationImagesService.send).not.toHaveBeenCalled();
    });

    it('aborts inside the transaction if the slot was taken by a concurrent booking after the pre-check', async () => {
      const resource = { id: 'r1', type: 'ROOM', userId: null, branchId: 'b1' };
      prisma.client.bookingService.findMany.mockResolvedValue([{ id: 's1', durationMinutes: 60, price: '50', name: 'Corte' }]);
      prisma.client.bookingResource.findMany.mockResolvedValue([resource]);
      prisma.client.bookingResource.findUnique.mockResolvedValue(resource);
      prisma.client.bookingResourceSchedule.findMany.mockResolvedValue([{ startMinute: 0, endMinute: 1440 }]);
      // Free during the pre-check (outside the transaction)...
      prisma.client.appointmentResource.findMany
        .mockResolvedValueOnce([])
        // ...but a concurrent booking landed on it by the time the
        // in-transaction re-check runs.
        .mockResolvedValueOnce([
          { appointment: { startAt: new Date('2026-01-05T09:00:00.000Z'), endAt: new Date('2026-01-05T10:00:00.000Z') } },
        ]);

      await expect(
        service.create({ contactId: 'c1', branchId: 'b1', serviceIds: ['s1'], startAt: '2026-01-05T09:00:00.000Z' } as any),
      ).rejects.toThrow(ValidationError);
      expect(tx.appointment.create).not.toHaveBeenCalled();
    });

    it('creates the appointment PENDING with no confirmedAt when the tenant requires manual approval', async () => {
      const resource = { id: 'r1', type: 'ROOM', userId: null, branchId: 'b1' };
      prisma.client.tenant.findUnique.mockResolvedValue({
        appointmentApprovalMode: 'MANUAL',
        notifyOnAppointmentPendingApproval: true,
      });
      prisma.client.bookingService.findMany.mockResolvedValue([{ id: 's1', durationMinutes: 60, price: '50', name: 'Corte' }]);
      prisma.client.bookingResource.findMany.mockResolvedValue([resource]);
      prisma.client.bookingResource.findUnique.mockResolvedValue(resource);
      prisma.client.bookingResourceSchedule.findMany.mockResolvedValue([{ startMinute: 0, endMinute: 1440 }]);
      prisma.client.appointmentResource.findMany.mockResolvedValue([]);
      tx.appointment.create.mockResolvedValue({ id: 'a1' });
      tx.appointment.findUnique.mockResolvedValue({
        id: 'a1',
        contactId: 'c1',
        startAt: '2026-01-05T09:00:00.000Z',
        subtotal: '50',
        total: '50',
        services: [],
      });

      await service.create({ contactId: 'c1', branchId: 'b1', serviceIds: ['s1'], startAt: '2026-01-05T09:00:00.000Z' } as any);

      expect(tx.appointment.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ status: 'PENDING', confirmedAt: null }),
      });
      expect(eventsService.emit).toHaveBeenCalledWith(
        'appointment.pending_approval',
        { appointmentId: 'a1', startAt: '2026-01-05T09:00:00.000Z' },
        'c1',
      );
      expect(notificationsService.create).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'appointment.pending_approval', link: '/dashboard/booking' }),
      );
    });

    it('skips the in-app notification when the tenant disabled it, but still emits the event', async () => {
      const resource = { id: 'r1', type: 'ROOM', userId: null, branchId: 'b1' };
      prisma.client.tenant.findUnique.mockResolvedValue({
        appointmentApprovalMode: 'MANUAL',
        notifyOnAppointmentPendingApproval: false,
      });
      prisma.client.bookingService.findMany.mockResolvedValue([{ id: 's1', durationMinutes: 60, price: '50', name: 'Corte' }]);
      prisma.client.bookingResource.findMany.mockResolvedValue([resource]);
      prisma.client.bookingResource.findUnique.mockResolvedValue(resource);
      prisma.client.bookingResourceSchedule.findMany.mockResolvedValue([{ startMinute: 0, endMinute: 1440 }]);
      prisma.client.appointmentResource.findMany.mockResolvedValue([]);
      tx.appointment.create.mockResolvedValue({ id: 'a1' });
      tx.appointment.findUnique.mockResolvedValue({
        id: 'a1',
        contactId: 'c1',
        startAt: '2026-01-05T09:00:00.000Z',
        subtotal: '50',
        total: '50',
        services: [],
      });

      await service.create({ contactId: 'c1', branchId: 'b1', serviceIds: ['s1'], startAt: '2026-01-05T09:00:00.000Z' } as any);

      expect(eventsService.emit).toHaveBeenCalledWith('appointment.pending_approval', expect.anything(), 'c1');
      expect(notificationsService.create).not.toHaveBeenCalled();
    });
  });

  describe('createGroup', () => {
    const resource = { id: 'r1', type: 'ROOM', userId: null, branchId: 'b1' };

    beforeEach(() => {
      prisma.client.bookingService.findMany.mockResolvedValue([{ id: 's1', durationMinutes: 60, price: '50', name: 'Revisión' }]);
      prisma.client.bookingResourceSchedule.findMany.mockResolvedValue([{ startMinute: 0, endMinute: 1440 }]);
      prisma.client.appointmentResource.findMany.mockResolvedValue([]);
    });

    it('creates one sequential, back-to-back appointment per patient, sharing a groupId', async () => {
      prisma.client.bookingResource.findMany.mockResolvedValue([resource]);
      prisma.client.bookingResource.findUnique.mockResolvedValue(resource);

      tx.appointment.create.mockResolvedValueOnce({ id: 'a1' }).mockResolvedValueOnce({ id: 'a2' });
      tx.appointment.findUnique
        .mockResolvedValueOnce({
          id: 'a1',
          contactId: 'c1',
          patientName: 'Juan',
          startAt: '2026-01-05T09:00:00.000Z',
          endAt: '2026-01-05T10:00:00.000Z',
          subtotal: '50',
          total: '50',
          currency: 'BOB',
          services: [],
        })
        .mockResolvedValueOnce({
          id: 'a2',
          contactId: 'c1',
          patientName: 'Ana',
          startAt: '2026-01-05T10:00:00.000Z',
          endAt: '2026-01-05T11:00:00.000Z',
          subtotal: '50',
          total: '50',
          currency: 'BOB',
          services: [],
        });

      const result = await service.createGroup({
        contactId: 'c1',
        branchId: 'b1',
        startAt: '2026-01-05T09:00:00.000Z',
        patients: [
          { patientName: 'Juan', serviceIds: ['s1'] },
          { patientName: 'Ana', serviceIds: ['s1'] },
        ],
      } as any);

      expect(result).toHaveLength(2);
      // Second patient's turn starts exactly when the first one's ends.
      expect(tx.appointment.create).toHaveBeenNthCalledWith(2, {
        data: expect.objectContaining({ startAt: new Date('2026-01-05T10:00:00.000Z') }),
      });
      const groupId1 = tx.appointment.create.mock.calls[0][0].data.groupId;
      const groupId2 = tx.appointment.create.mock.calls[1][0].data.groupId;
      expect(groupId1).toBeTruthy();
      expect(groupId1).toBe(groupId2);
      expect(tx.appointment.create.mock.calls[0][0].data.patientName).toBe('Juan');
      expect(tx.appointment.create.mock.calls[1][0].data.patientName).toBe('Ana');
    });

    it('cancels already-created appointments when a later patient cannot be fit, and rejects', async () => {
      // First patient finds a resource; second patient finds none.
      prisma.client.bookingResource.findMany.mockResolvedValueOnce([resource]).mockResolvedValueOnce([]);
      prisma.client.bookingResource.findUnique.mockResolvedValue(resource);
      prisma.client.appointment.findUnique.mockResolvedValue({ id: 'a1', status: 'CONFIRMED', contactId: 'c1' });

      tx.appointment.create.mockResolvedValueOnce({ id: 'a1' });
      tx.appointment.findUnique.mockResolvedValueOnce({
        id: 'a1',
        contactId: 'c1',
        patientName: 'Juan',
        startAt: '2026-01-05T09:00:00.000Z',
        endAt: '2026-01-05T10:00:00.000Z',
        subtotal: '50',
        total: '50',
        currency: 'BOB',
        services: [],
      });

      await expect(
        service.createGroup({
          contactId: 'c1',
          branchId: 'b1',
          startAt: '2026-01-05T09:00:00.000Z',
          patients: [
            { patientName: 'Juan', serviceIds: ['s1'] },
            { patientName: 'Ana', serviceIds: ['s1'] },
          ],
        } as any),
      ).rejects.toThrow(ValidationError);

      expect(tx.appointment.update).toHaveBeenCalledWith({
        where: { id: 'a1' },
        data: expect.objectContaining({ status: 'CANCELLED' }),
      });
    });

    it('sends one combined confirmation image set for the whole group, not one per patient', async () => {
      prisma.client.bookingResource.findMany.mockResolvedValue([resource]);
      prisma.client.bookingResource.findUnique.mockResolvedValue(resource);
      prisma.client.tenant.findUnique.mockResolvedValue({
        name: 'Demo Co',
        appointmentApprovalMode: 'AUTOMATIC',
        notifyOnAppointmentPendingApproval: true,
        sendAppointmentQrCode: true,
        sendAppointmentReceiptImage: true,
      });
      prisma.client.commerceSession.findUnique.mockResolvedValue({ conversationId: 'conv1' });
      prisma.client.branch.findUnique.mockResolvedValue({ timezone: 'UTC', name: 'Sucursal Centro' });

      tx.appointment.create.mockResolvedValueOnce({ id: 'a1' }).mockResolvedValueOnce({ id: 'a2' });
      tx.appointment.findUnique
        .mockResolvedValueOnce({
          id: 'a1', contactId: 'c1', branchId: 'b1', patientName: 'Juan',
          startAt: '2026-01-05T09:00:00.000Z', endAt: '2026-01-05T10:00:00.000Z',
          subtotal: '50', total: '50', currency: 'BOB', services: [],
        })
        .mockResolvedValueOnce({
          id: 'a2', contactId: 'c1', branchId: 'b1', patientName: 'Ana',
          startAt: '2026-01-05T10:00:00.000Z', endAt: '2026-01-05T11:00:00.000Z',
          subtotal: '50', total: '50', currency: 'BOB', services: [],
        });

      await service.createGroup({
        contactId: 'c1',
        branchId: 'b1',
        startAt: '2026-01-05T09:00:00.000Z',
        commerceSessionId: 'sess1',
        patients: [
          { patientName: 'Juan', serviceIds: ['s1'] },
          { patientName: 'Ana', serviceIds: ['s1'] },
        ],
      } as any);

      expect(confirmationImagesService.send).toHaveBeenCalledTimes(1);
      expect(confirmationImagesService.send).toHaveBeenCalledWith(
        expect.objectContaining({ conversationId: 'conv1', sendQrCode: true, sendReceiptImage: true }),
      );
    });
  });

  describe('reschedule', () => {
    const appt = {
      id: 'a1',
      status: 'CONFIRMED',
      startAt: '2026-01-05T09:00:00.000Z',
      endAt: '2026-01-05T10:00:00.000Z',
      resources: [{ resourceId: 'r1' }],
    };

    it('rejects when the resource is not available at the new time', async () => {
      prisma.client.appointment.findUnique.mockResolvedValue(appt);
      prisma.client.bookingResource.findUnique.mockResolvedValue({ id: 'r1', type: 'ROOM', userId: null });
      prisma.client.bookingResourceSchedule.findMany.mockResolvedValue([]);
      prisma.client.appointmentResource.findMany.mockResolvedValue([]);

      await expect(
        service.reschedule('a1', { startAt: '2026-01-06T09:00:00.000Z', endAt: '2026-01-06T10:00:00.000Z' } as any),
      ).rejects.toThrow(ValidationError);
    });

    it('rejects rescheduling a terminal appointment', async () => {
      prisma.client.appointment.findUnique.mockResolvedValue({ ...appt, status: 'CANCELLED' });
      await expect(service.reschedule('a1', { startAt: '2026-01-06T09:00:00.000Z' } as any)).rejects.toThrow(ValidationError);
    });

    it('updates the time when the resource is available', async () => {
      prisma.client.appointment.findUnique.mockResolvedValue(appt);
      prisma.client.bookingResource.findUnique.mockResolvedValue({ id: 'r1', type: 'ROOM', userId: null });
      prisma.client.bookingResourceSchedule.findMany.mockResolvedValue([{ startMinute: 0, endMinute: 1440 }]);
      prisma.client.appointmentResource.findMany.mockResolvedValue([]);

      await service.reschedule('a1', { startAt: '2026-01-06T09:00:00.000Z', endAt: '2026-01-06T10:00:00.000Z' } as any);

      expect(tx.appointment.update).toHaveBeenCalledWith({
        where: { id: 'a1' },
        data: { startAt: new Date('2026-01-06T09:00:00.000Z'), endAt: new Date('2026-01-06T10:00:00.000Z') },
      });
    });

    it('updates notes alongside the time when given', async () => {
      prisma.client.appointment.findUnique.mockResolvedValue(appt);
      prisma.client.bookingResource.findUnique.mockResolvedValue({ id: 'r1', type: 'ROOM', userId: null });
      prisma.client.bookingResourceSchedule.findMany.mockResolvedValue([{ startMinute: 0, endMinute: 1440 }]);
      prisma.client.appointmentResource.findMany.mockResolvedValue([]);

      await service.reschedule('a1', {
        startAt: '2026-01-06T09:00:00.000Z',
        endAt: '2026-01-06T10:00:00.000Z',
        notes: 'Cliente pidió cambiar de horario',
      } as any);

      expect(tx.appointment.update).toHaveBeenCalledWith({
        where: { id: 'a1' },
        data: {
          startAt: new Date('2026-01-06T09:00:00.000Z'),
          endAt: new Date('2026-01-06T10:00:00.000Z'),
          notes: 'Cliente pidió cambiar de horario',
        },
      });
    });
  });

  describe('transition graph', () => {
    it.each([
      ['PENDING', 'COMPLETED'],
      ['CONFIRMED', 'PENDING'],
      ['COMPLETED', 'CANCELLED'],
      ['NO_SHOW', 'CONFIRMED'],
    ])('rejects the illegal jump %s -> %s', async (from, to) => {
      prisma.client.appointment.findUnique.mockResolvedValue({ id: 'a1', status: from });
      await expect(service.setStatus('a1', 'u1', { status: to } as any)).rejects.toThrow(ValidationError);
      expect(prisma.client.$transaction).not.toHaveBeenCalled();
    });

    it.each([
      ['PENDING', 'CONFIRMED'],
      ['CONFIRMED', 'COMPLETED'],
      ['CONFIRMED', 'NO_SHOW'],
      ['CONFIRMED', 'CANCELLED'],
    ])('allows the legal transition %s -> %s', async (from, to) => {
      prisma.client.appointment.findUnique.mockResolvedValue({ id: 'a1', status: from, contactId: 'c1' });

      await service.setStatus('a1', 'u1', { status: to } as any);

      expect(tx.appointment.update).toHaveBeenCalledWith({
        where: { id: 'a1' },
        data: to === 'CONFIRMED' ? { status: to, confirmedAt: expect.any(Date) } : { status: to },
      });
      expect(tx.appointmentStatusHistory.create).toHaveBeenCalledWith({
        data: { appointmentId: 'a1', fromStatus: from, toStatus: to, note: undefined, changedByUserId: 'u1' },
      });

      const eventByStatus: Record<string, string> = {
        CONFIRMED: 'appointment.confirmed',
        CANCELLED: 'appointment.cancelled',
        COMPLETED: 'appointment.completed',
        NO_SHOW: 'appointment.no_show',
      };
      expect(eventsService.emit).toHaveBeenCalledWith(
        eventByStatus[to],
        { appointmentId: 'a1', fromStatus: from, toStatus: to },
        'c1',
      );
    });
  });

  describe('list', () => {
    it('filters by groupId and orders earliest-first for a group booking', async () => {
      prisma.client.appointment.findMany.mockResolvedValue([]);
      await service.list({ groupId: 'g1' } as any);
      expect(prisma.client.appointment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { groupId: 'g1' }, orderBy: { startAt: 'asc' } }),
      );
    });

    it('defaults to newest-first when not filtering by groupId', async () => {
      prisma.client.appointment.findMany.mockResolvedValue([]);
      await service.list({} as any);
      expect(prisma.client.appointment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: {}, orderBy: { startAt: 'desc' } }),
      );
    });
  });

  describe('listStatusHistory', () => {
    it('verifies the appointment exists then lists history newest-first', async () => {
      prisma.client.appointment.findUnique.mockResolvedValue({ id: 'a1' });
      prisma.client.appointmentStatusHistory.findMany.mockResolvedValue([]);

      await service.listStatusHistory('a1');

      expect(prisma.client.appointmentStatusHistory.findMany).toHaveBeenCalledWith({
        where: { appointmentId: 'a1' },
        orderBy: { createdAt: 'desc' },
      });
    });
  });
});
