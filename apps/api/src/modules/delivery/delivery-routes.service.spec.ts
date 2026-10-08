import { DeliveryRoutesService } from './delivery-routes.service';
import { NotFoundError, ValidationError } from '@omniflow/utils';

function route(overrides: any = {}) {
  return {
    id: 'r1',
    tenantId: 't1',
    branchId: 'b1',
    status: 'PLANNED',
    stops: [],
    ...overrides,
  };
}

function stop(overrides: any = {}) {
  return {
    id: 's1',
    routeId: 'r1',
    status: 'PENDING',
    sequence: 0,
    fulfillment: { id: 'f1', order: { id: 'o1' } },
    ...overrides,
  };
}

describe('DeliveryRoutesService', () => {
  let service: DeliveryRoutesService;
  let prisma: any;
  let eventsService: any;
  let ordersService: any;
  let queueService: any;
  let deliveryProviderConfigService: any;

  beforeEach(() => {
    prisma = {
      client: {
        deliveryRoute: { findUnique: jest.fn(), findMany: jest.fn(), create: jest.fn(), update: jest.fn() },
        deliveryRouteStop: {
          create: jest.fn(),
          delete: jest.fn(),
          update: jest.fn(),
          findUnique: jest.fn(),
          findMany: jest.fn(),
          aggregate: jest.fn().mockResolvedValue({ _max: { sequence: null } }),
        },
        fulfillment: { findUnique: jest.fn(), findMany: jest.fn() },
        driver: { findUnique: jest.fn() },
        vehicle: { findUnique: jest.fn() },
        deliveryAssignment: { create: jest.fn(), update: jest.fn() },
        $transaction: jest.fn((ops: any) => Promise.all(ops)),
      },
    };
    eventsService = { emit: jest.fn() };
    ordersService = { setStatus: jest.fn() };
    queueService = { enqueueDeliveryNotify: jest.fn() };
    deliveryProviderConfigService = { resolveForBranch: jest.fn().mockResolvedValue(null) };
    service = new DeliveryRoutesService(prisma, eventsService, ordersService, queueService, deliveryProviderConfigService);
  });

  describe('findOne', () => {
    it('throws NotFoundError when missing', async () => {
      prisma.client.deliveryRoute.findUnique.mockResolvedValue(null);
      await expect(service.findOne('r1')).rejects.toThrow(NotFoundError);
    });

    it('throws NotFoundError for a route outside the caller\'s branches', async () => {
      prisma.client.deliveryRoute.findUnique.mockResolvedValue(route({ branchId: 'other' }));
      await expect(service.findOne('r1', ['b1'])).rejects.toThrow(NotFoundError);
    });

    it('returns the route when unrestricted', async () => {
      prisma.client.deliveryRoute.findUnique.mockResolvedValue(route());
      const result = await service.findOne('r1');
      expect(result.id).toBe('r1');
    });
  });

  describe('create', () => {
    it('rejects creating a route for a branch outside the caller\'s allowed set', async () => {
      await expect(
        service.create('t1', { branchId: 'other', routeDate: '2026-01-01' } as any, ['b1']),
      ).rejects.toThrow(NotFoundError);
    });

    it('creates the route and emits route.created', async () => {
      prisma.client.deliveryRoute.create.mockResolvedValue(route());
      const result = await service.create('t1', { branchId: 'b1', routeDate: '2026-01-01' } as any, ['b1']);
      expect(result.id).toBe('r1');
      expect(eventsService.emit).toHaveBeenCalledWith('route.created', expect.objectContaining({ routeId: 'r1' }));
    });
  });

  describe('addStop', () => {
    it('rejects a fulfillment that is not LOCAL_DELIVERY', async () => {
      prisma.client.deliveryRoute.findUnique.mockResolvedValue(route());
      prisma.client.fulfillment.findUnique.mockResolvedValue({
        id: 'f1',
        type: 'PICKUP',
        branchId: 'b1',
        routeStop: null,
      });
      await expect(service.addStop('r1', { fulfillmentId: 'f1' } as any)).rejects.toThrow(ValidationError);
    });

    it('rejects a fulfillment already assigned to another route', async () => {
      prisma.client.deliveryRoute.findUnique.mockResolvedValue(route());
      prisma.client.fulfillment.findUnique.mockResolvedValue({
        id: 'f1',
        type: 'LOCAL_DELIVERY',
        branchId: 'b1',
        routeStop: { id: 's-existing' },
      });
      await expect(service.addStop('r1', { fulfillmentId: 'f1' } as any)).rejects.toThrow(ValidationError);
    });

    it('rejects a fulfillment from a different branch than the route', async () => {
      prisma.client.deliveryRoute.findUnique.mockResolvedValue(route({ branchId: 'b1' }));
      prisma.client.fulfillment.findUnique.mockResolvedValue({
        id: 'f1',
        type: 'LOCAL_DELIVERY',
        branchId: 'b2',
        routeStop: null,
      });
      await expect(service.addStop('r1', { fulfillmentId: 'f1' } as any)).rejects.toThrow(ValidationError);
    });

    it('appends the stop at sequence 0 when the route has no stops yet', async () => {
      prisma.client.deliveryRoute.findUnique
        .mockResolvedValueOnce(route())
        .mockResolvedValueOnce(route({ stops: [stop()] }));
      prisma.client.fulfillment.findUnique.mockResolvedValue({
        id: 'f1',
        type: 'LOCAL_DELIVERY',
        branchId: 'b1',
        routeStop: null,
      });
      await service.addStop('r1', { fulfillmentId: 'f1' } as any);
      expect(prisma.client.deliveryRouteStop.create).toHaveBeenCalledWith({
        data: { routeId: 'r1', fulfillmentId: 'f1', sequence: 0 },
      });
    });
  });

  describe('reorderStops', () => {
    it('rejects when the given stop ids do not match the route\'s current stops', async () => {
      prisma.client.deliveryRoute.findUnique.mockResolvedValue(route());
      prisma.client.deliveryRouteStop.findMany.mockResolvedValue([stop({ id: 's1' }), stop({ id: 's2' })]);
      await expect(service.reorderStops('r1', { stopIds: ['s1'] } as any)).rejects.toThrow(ValidationError);
    });
  });

  describe('start', () => {
    it('rejects starting a route that is already IN_ROUTE', async () => {
      prisma.client.deliveryRoute.findUnique.mockResolvedValue(route({ status: 'IN_ROUTE' }));
      await expect(service.start('r1')).rejects.toThrow(ValidationError);
    });

    it('moves PLANNED to IN_ROUTE and emits route.started', async () => {
      prisma.client.deliveryRoute.findUnique.mockResolvedValue(route({ status: 'PLANNED' }));
      await service.start('r1');
      expect(prisma.client.deliveryRoute.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'IN_ROUTE' }) }),
      );
      expect(eventsService.emit).toHaveBeenCalledWith('route.started', { routeId: 'r1' });
    });
  });

  describe('completeStop', () => {
    it('rejects completing a stop that was already resolved', async () => {
      prisma.client.deliveryRoute.findUnique.mockResolvedValue(route({ stops: [stop({ status: 'COMPLETED' })] }));
      await expect(service.completeStop('r1', 's1', 'u1')).rejects.toThrow(ValidationError);
    });

    it('marks the stop COMPLETED and delivers the underlying order via OrdersService', async () => {
      prisma.client.deliveryRoute.findUnique.mockResolvedValue(route({ stops: [stop()] }));
      await service.completeStop('r1', 's1', 'u1', ['b1']);
      expect(prisma.client.deliveryRouteStop.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 's1' }, data: expect.objectContaining({ status: 'COMPLETED' }) }),
      );
      expect(ordersService.setStatus).toHaveBeenCalledWith('o1', 'u1', { status: 'DELIVERED' }, ['b1']);
    });
  });

  describe('failStop', () => {
    it('marks the stop FAILED and does not touch the order', async () => {
      prisma.client.deliveryRoute.findUnique.mockResolvedValue(route({ stops: [stop()] }));
      await service.failStop('r1', 's1', { note: 'no estaba en casa' } as any);
      expect(prisma.client.deliveryRouteStop.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'FAILED', notes: 'no estaba en casa' }) }),
      );
      expect(ordersService.setStatus).not.toHaveBeenCalled();
    });
  });

  describe('complete', () => {
    it('rejects completing while a stop is still PENDING', async () => {
      prisma.client.deliveryRoute.findUnique.mockResolvedValue(route({ stops: [stop({ status: 'PENDING' })] }));
      await expect(service.complete('r1')).rejects.toThrow(ValidationError);
    });

    it('sets COMPLETED when every stop is COMPLETED', async () => {
      prisma.client.deliveryRoute.findUnique.mockResolvedValue(route({ stops: [stop({ status: 'COMPLETED' })] }));
      await service.complete('r1');
      expect(prisma.client.deliveryRoute.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'COMPLETED' }) }),
      );
      expect(eventsService.emit).toHaveBeenCalledWith('route.completed', { routeId: 'r1' });
    });

    it('sets PARTIALLY_COMPLETED when some stop FAILED', async () => {
      prisma.client.deliveryRoute.findUnique.mockResolvedValue(
        route({ stops: [stop({ status: 'COMPLETED' }), stop({ id: 's2', status: 'FAILED' })] }),
      );
      await service.complete('r1');
      expect(prisma.client.deliveryRoute.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'PARTIALLY_COMPLETED' }) }),
      );
    });
  });

  describe('addStop — Telegram notify', () => {
    it('enqueues a notify job when the branch is configured for TELEGRAM_NOTIFY', async () => {
      prisma.client.deliveryRoute.findUnique
        .mockResolvedValueOnce(route())
        .mockResolvedValueOnce(route({ stops: [stop()] }));
      prisma.client.fulfillment.findUnique.mockResolvedValue({
        id: 'f1',
        type: 'LOCAL_DELIVERY',
        branchId: 'b1',
        routeStop: null,
      });
      deliveryProviderConfigService.resolveForBranch.mockResolvedValue({ type: 'TELEGRAM_NOTIFY' });
      prisma.client.deliveryRouteStop.create.mockResolvedValue({ id: 's1' });

      await service.addStop('r1', { fulfillmentId: 'f1' } as any);
      expect(queueService.enqueueDeliveryNotify).toHaveBeenCalledWith('t1', 's1');
    });

    it('does not enqueue anything for OWN_FLEET (default) branches', async () => {
      prisma.client.deliveryRoute.findUnique
        .mockResolvedValueOnce(route())
        .mockResolvedValueOnce(route({ stops: [stop()] }));
      prisma.client.fulfillment.findUnique.mockResolvedValue({
        id: 'f1',
        type: 'LOCAL_DELIVERY',
        branchId: 'b1',
        routeStop: null,
      });
      prisma.client.deliveryRouteStop.create.mockResolvedValue({ id: 's1' });

      await service.addStop('r1', { fulfillmentId: 'f1' } as any);
      expect(queueService.enqueueDeliveryNotify).not.toHaveBeenCalled();
    });
  });

  describe('assignDriver', () => {
    it('rejects an inactive driver', async () => {
      prisma.client.deliveryRoute.findUnique.mockResolvedValue(route());
      prisma.client.driver.findUnique.mockResolvedValue({ id: 'd1', status: 'INACTIVE', branchId: null });
      await expect(service.assignDriver('r1', { driverId: 'd1' } as any, 'u1')).rejects.toThrow(ValidationError);
    });

    it('rejects a driver tied to a different branch', async () => {
      prisma.client.deliveryRoute.findUnique.mockResolvedValue(route({ branchId: 'b1' }));
      prisma.client.driver.findUnique.mockResolvedValue({ id: 'd1', status: 'ACTIVE', branchId: 'b2' });
      await expect(service.assignDriver('r1', { driverId: 'd1' } as any, 'u1')).rejects.toThrow(ValidationError);
    });

    it('creates a new assignment when none exists yet', async () => {
      prisma.client.deliveryRoute.findUnique.mockResolvedValue(route());
      prisma.client.driver.findUnique.mockResolvedValue({ id: 'd1', status: 'ACTIVE', branchId: null });

      await service.assignDriver('r1', { driverId: 'd1' } as any, 'u1');
      expect(prisma.client.deliveryAssignment.create).toHaveBeenCalledWith({
        data: { tenantId: 't1', routeId: 'r1', driverId: 'd1', vehicleId: undefined, assignedByUserId: 'u1' },
      });
      expect(prisma.client.deliveryAssignment.update).not.toHaveBeenCalled();
    });

    it('closes the previous assignment before creating the new one', async () => {
      prisma.client.deliveryRoute.findUnique.mockResolvedValue(
        route({ assignments: [{ id: 'assign-old' }] }),
      );
      prisma.client.driver.findUnique.mockResolvedValue({ id: 'd2', status: 'ACTIVE', branchId: null });

      await service.assignDriver('r1', { driverId: 'd2' } as any, 'u1');
      expect(prisma.client.deliveryAssignment.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'assign-old' }, data: expect.objectContaining({ unassignedAt: expect.any(Date) }) }),
      );
      expect(prisma.client.deliveryAssignment.create).toHaveBeenCalled();
    });
  });
});
