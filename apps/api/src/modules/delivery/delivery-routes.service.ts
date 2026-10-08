import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundError, ValidationError } from '@omniflow/utils';
import { EventsService } from '../events/events.service';
import { OrdersService } from '../commerce/orders.service';
import { QueueService } from '../queue/queue.service';
import { DeliveryProviderConfigService } from './delivery-provider-config.service';
import {
  ListDeliveryRoutesQueryDto,
  CreateDeliveryRouteDto,
  UpdateDeliveryRouteDto,
  AddRouteStopDto,
  ReorderRouteStopsDto,
  FailRouteStopDto,
  AssignDriverDto,
} from './delivery-route.dto';

const ROUTE_INCLUDE = {
  responsibleUser: { select: { id: true, email: true } },
  assignments: {
    where: { unassignedAt: null },
    include: { driver: true, vehicle: true },
  },
  stops: {
    orderBy: { sequence: 'asc' as const },
    include: {
      fulfillment: {
        include: {
          order: {
            select: {
              id: true,
              orderNumber: true,
              contact: { select: { id: true, name: true } },
              address: true,
            },
          },
        },
      },
    },
  },
};

// Same branchIds contract as OrdersService — empty means unrestricted.
function assertBranchAllowed(branchId: string, branchIds: string[]) {
  if (branchIds.length && !branchIds.includes(branchId)) {
    throw new NotFoundError('Branch');
  }
}

@Injectable()
export class DeliveryRoutesService {
  constructor(
    private prisma: PrismaService,
    private eventsService: EventsService,
    private ordersService: OrdersService,
    private queueService: QueueService,
    private deliveryProviderConfigService: DeliveryProviderConfigService,
  ) {}

  async list(query: ListDeliveryRoutesQueryDto, branchIds: string[] = []) {
    if (branchIds.length && query.branchId && !branchIds.includes(query.branchId)) {
      return [];
    }
    return this.prisma.client.deliveryRoute.findMany({
      where: {
        ...(query.status && { status: query.status }),
        ...(query.routeDate && { routeDate: new Date(query.routeDate) }),
        ...(query.branchId
          ? { branchId: query.branchId }
          : branchIds.length
            ? { branchId: { in: branchIds } }
            : {}),
      },
      include: { responsibleUser: { select: { id: true, email: true } }, _count: { select: { stops: true } } },
      orderBy: { routeDate: 'desc' },
    });
  }

  // Backs the "Agregar parada" picker — LOCAL_DELIVERY fulfillments of this
  // branch not already on any route, not yet delivered/cancelled.
  async listAvailableFulfillments(branchId: string, branchIds: string[] = []) {
    assertBranchAllowed(branchId, branchIds);
    return this.prisma.client.fulfillment.findMany({
      where: {
        branchId,
        type: 'LOCAL_DELIVERY',
        routeStop: null,
        order: { status: { notIn: ['DELIVERED', 'CANCELLED'] } },
      },
      include: {
        order: { select: { id: true, orderNumber: true, contact: { select: { id: true, name: true } } } },
        address: true,
      },
    });
  }

  // Mirrors OrdersService.findOne: the single choke point every mutation
  // below routes through, so the branch check only needs to live here once.
  async findOne(id: string, branchIds: string[] = []) {
    const route = await this.prisma.client.deliveryRoute.findUnique({ where: { id }, include: ROUTE_INCLUDE });
    if (!route) throw new NotFoundError('DeliveryRoute');
    if (branchIds.length && !branchIds.includes(route.branchId)) {
      throw new NotFoundError('DeliveryRoute');
    }
    return route;
  }

  async create(tenantId: string, dto: CreateDeliveryRouteDto, branchIds: string[] = []) {
    assertBranchAllowed(dto.branchId, branchIds);

    const route = await this.prisma.client.deliveryRoute.create({
      data: {
        tenantId,
        branchId: dto.branchId,
        routeDate: new Date(dto.routeDate),
        responsibleUserId: dto.responsibleUserId,
        notes: dto.notes,
      },
      include: ROUTE_INCLUDE,
    });
    await this.eventsService.emit('route.created', { routeId: route.id, branchId: route.branchId });
    return route;
  }

  async update(id: string, dto: UpdateDeliveryRouteDto, branchIds: string[] = []) {
    const route = await this.findOne(id, branchIds);
    if (dto.status) {
      if (dto.status !== 'CANCELLED') {
        throw new ValidationError('Solo se puede cancelar una ruta desde esta acción; el resto de los estados se maneja con iniciar/completar.');
      }
      if (route.status === 'IN_ROUTE' || route.status === 'COMPLETED') {
        throw new ValidationError('No se puede cancelar una ruta que ya está en curso o completada.');
      }
    }

    return this.prisma.client.deliveryRoute.update({
      where: { id },
      data: {
        ...(dto.responsibleUserId !== undefined && { responsibleUserId: dto.responsibleUserId }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
        ...(dto.status && { status: dto.status }),
      },
      include: ROUTE_INCLUDE,
    });
  }

  async addStop(routeId: string, dto: AddRouteStopDto, branchIds: string[] = []) {
    const route = await this.findOne(routeId, branchIds);

    const fulfillment = await this.prisma.client.fulfillment.findUnique({
      where: { id: dto.fulfillmentId },
      include: { routeStop: true },
    });
    if (!fulfillment) throw new NotFoundError('Fulfillment');
    if (fulfillment.type !== 'LOCAL_DELIVERY') {
      throw new ValidationError('Solo se pueden agregar a una ruta entregas a domicilio (LOCAL_DELIVERY).');
    }
    if (fulfillment.branchId !== route.branchId) {
      throw new ValidationError('El pedido pertenece a otra sucursal, no a la de esta ruta.');
    }
    if (fulfillment.routeStop) {
      throw new ValidationError('Este pedido ya está asignado a otra ruta.');
    }

    const maxSequence = await this.prisma.client.deliveryRouteStop.aggregate({
      where: { routeId },
      _max: { sequence: true },
    });

    const stop = await this.prisma.client.deliveryRouteStop.create({
      data: { routeId, fulfillmentId: dto.fulfillmentId, sequence: (maxSequence._max.sequence ?? -1) + 1 },
    });

    // Telegram notify is a per-branch/tenant-default delivery method, not a
    // call made synchronously here — only enqueue, the worker does the
    // actual Bot API call so this request never blocks on it.
    const providerConfig = await this.deliveryProviderConfigService.resolveForBranch(route.tenantId, route.branchId);
    if (providerConfig?.type === 'TELEGRAM_NOTIFY') {
      await this.queueService.enqueueDeliveryNotify(route.tenantId, stop.id);
    }

    return this.findOne(routeId, branchIds);
  }

  // Asignar un conductor (y, opcionalmente, el vehículo que usa hoy) a esta
  // ruta. No pisa la asignación anterior: la cierra (unassignedAt) y crea
  // una fila nueva — historial completo, igual que exige auditar
  // "rutas y asignaciones" (SECURITY.md).
  async assignDriver(routeId: string, dto: AssignDriverDto, actorUserId: string, branchIds: string[] = []) {
    const route = await this.findOne(routeId, branchIds);

    const driver = await this.prisma.client.driver.findUnique({ where: { id: dto.driverId } });
    if (!driver) throw new NotFoundError('Driver');
    if (driver.status !== 'ACTIVE') {
      throw new ValidationError('Este conductor está inactivo.');
    }
    if (driver.branchId && driver.branchId !== route.branchId) {
      throw new ValidationError('Este conductor no pertenece a la sucursal de esta ruta.');
    }

    if (dto.vehicleId) {
      const vehicle = await this.prisma.client.vehicle.findUnique({ where: { id: dto.vehicleId } });
      if (!vehicle) throw new NotFoundError('Vehicle');
      if (vehicle.branchId && vehicle.branchId !== route.branchId) {
        throw new ValidationError('Este vehículo no pertenece a la sucursal de esta ruta.');
      }
    }

    const currentAssignment = (route as any).assignments?.[0];
    await this.prisma.client.$transaction([
      ...(currentAssignment
        ? [
            this.prisma.client.deliveryAssignment.update({
              where: { id: currentAssignment.id },
              data: { unassignedAt: new Date() },
            }),
          ]
        : []),
      this.prisma.client.deliveryAssignment.create({
        data: {
          tenantId: route.tenantId,
          routeId,
          driverId: dto.driverId,
          vehicleId: dto.vehicleId,
          assignedByUserId: actorUserId,
        },
      }),
    ]);
    return this.findOne(routeId, branchIds);
  }

  async removeStop(routeId: string, stopId: string, branchIds: string[] = []) {
    await this.findOne(routeId, branchIds);
    const stop = await this.prisma.client.deliveryRouteStop.findUnique({ where: { id: stopId } });
    if (!stop || stop.routeId !== routeId) throw new NotFoundError('DeliveryRouteStop');

    await this.prisma.client.deliveryRouteStop.delete({ where: { id: stopId } });
    return this.findOne(routeId, branchIds);
  }

  async reorderStops(routeId: string, dto: ReorderRouteStopsDto, branchIds: string[] = []) {
    await this.findOne(routeId, branchIds);
    const stops = await this.prisma.client.deliveryRouteStop.findMany({ where: { routeId } });
    if (stops.length !== dto.stopIds.length || !stops.every((s: any) => dto.stopIds.includes(s.id))) {
      throw new ValidationError('La lista de paradas no coincide con las paradas actuales de la ruta.');
    }

    await this.prisma.client.$transaction(
      dto.stopIds.map((stopId, index) =>
        this.prisma.client.deliveryRouteStop.update({ where: { id: stopId }, data: { sequence: index } }),
      ),
    );
    return this.findOne(routeId, branchIds);
  }

  async start(routeId: string, branchIds: string[] = []) {
    const route = await this.findOne(routeId, branchIds);
    if (route.status !== 'PLANNED' && route.status !== 'PREPARING') {
      throw new ValidationError('Solo se puede iniciar una ruta que está planificada o en preparación.');
    }

    await this.prisma.client.deliveryRoute.update({
      where: { id: routeId },
      data: { status: 'IN_ROUTE', startedAt: new Date() },
    });
    await this.eventsService.emit('route.started', { routeId });
    return this.findOne(routeId, branchIds);
  }

  async completeStop(routeId: string, stopId: string, actorUserId: string, branchIds: string[] = []) {
    const route = await this.findOne(routeId, branchIds);
    const stop = route.stops.find((s: any) => s.id === stopId);
    if (!stop) throw new NotFoundError('DeliveryRouteStop');
    if (stop.status !== 'PENDING') {
      throw new ValidationError('Esta parada ya fue resuelta.');
    }

    await this.prisma.client.deliveryRouteStop.update({
      where: { id: stopId },
      data: { status: 'COMPLETED', completedAt: new Date() },
    });

    // Reuses OrdersService's own DELIVERED transition — stock deduction and
    // order.delivered event already live there, the route just orchestrates it.
    const orderId = (stop as any).fulfillment.order?.id;
    if (orderId) {
      await this.ordersService.setStatus(orderId, actorUserId, { status: 'DELIVERED' as any }, branchIds);
    }
    return this.findOne(routeId, branchIds);
  }

  async failStop(routeId: string, stopId: string, dto: FailRouteStopDto, branchIds: string[] = []) {
    const route = await this.findOne(routeId, branchIds);
    const stop = route.stops.find((s: any) => s.id === stopId);
    if (!stop) throw new NotFoundError('DeliveryRouteStop');
    if (stop.status !== 'PENDING') {
      throw new ValidationError('Esta parada ya fue resuelta.');
    }

    await this.prisma.client.deliveryRouteStop.update({
      where: { id: stopId },
      data: { status: 'FAILED', completedAt: new Date(), notes: dto.note },
    });
    return this.findOne(routeId, branchIds);
  }

  async complete(routeId: string, branchIds: string[] = []) {
    const route = await this.findOne(routeId, branchIds);
    if (route.stops.some((s: any) => s.status === 'PENDING')) {
      throw new ValidationError('No se puede completar la ruta mientras haya paradas pendientes.');
    }

    const allCompleted = route.stops.every((s: any) => s.status === 'COMPLETED');
    await this.prisma.client.deliveryRoute.update({
      where: { id: routeId },
      data: {
        status: allCompleted ? 'COMPLETED' : 'PARTIALLY_COMPLETED',
        completedAt: new Date(),
      },
    });
    await this.eventsService.emit('route.completed', { routeId });
    return this.findOne(routeId, branchIds);
  }
}
