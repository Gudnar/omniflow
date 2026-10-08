import { Controller, Get, Post, Patch, Delete, Body, Param, Query, Request, UseGuards, HttpCode } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards';
import { RequirePermission } from '../auth/decorators';
import { DeliveryRoutesService } from './delivery-routes.service';
import {
  ListDeliveryRoutesQueryDto,
  CreateDeliveryRouteDto,
  UpdateDeliveryRouteDto,
  AddRouteStopDto,
  ReorderRouteStopsDto,
  FailRouteStopDto,
  AssignDriverDto,
} from './delivery-route.dto';

// Managing a delivery route IS managing the fulfillment of the orders on it
// — reuses orders.read/orders.fulfill rather than inventing delivery.* codes
// (see Phase 19 plan). A branch-restricted courier with just orders.fulfill
// can run their own route the same way a branch-restricted staffer fulfills
// orders today.
@Controller('delivery/routes')
export class DeliveryRoutesController {
  constructor(private deliveryRoutesService: DeliveryRoutesService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  @RequirePermission('orders.read')
  @HttpCode(200)
  list(@Request() req: any, @Query() query: ListDeliveryRoutesQueryDto) {
    return this.deliveryRoutesService.list(query, req.user.branchIds);
  }

  // Declared before ':id' so it isn't swallowed as a route id.
  @Get('available-fulfillments')
  @UseGuards(JwtAuthGuard)
  @RequirePermission('orders.read')
  @HttpCode(200)
  listAvailableFulfillments(@Request() req: any, @Query('branchId') branchId: string) {
    return this.deliveryRoutesService.listAvailableFulfillments(branchId, req.user.branchIds);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @RequirePermission('orders.read')
  @HttpCode(200)
  findOne(@Request() req: any, @Param('id') id: string) {
    return this.deliveryRoutesService.findOne(id, req.user.branchIds);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @RequirePermission('orders.fulfill')
  create(@Request() req: any, @Body() dto: CreateDeliveryRouteDto) {
    return this.deliveryRoutesService.create(req.user.tenantId, dto, req.user.branchIds);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @RequirePermission('orders.fulfill')
  update(@Request() req: any, @Param('id') id: string, @Body() dto: UpdateDeliveryRouteDto) {
    return this.deliveryRoutesService.update(id, dto, req.user.branchIds);
  }

  @Post(':id/stops')
  @UseGuards(JwtAuthGuard)
  @RequirePermission('orders.fulfill')
  addStop(@Request() req: any, @Param('id') id: string, @Body() dto: AddRouteStopDto) {
    return this.deliveryRoutesService.addStop(id, dto, req.user.branchIds);
  }

  @Delete(':id/stops/:stopId')
  @UseGuards(JwtAuthGuard)
  @RequirePermission('orders.fulfill')
  removeStop(@Request() req: any, @Param('id') id: string, @Param('stopId') stopId: string) {
    return this.deliveryRoutesService.removeStop(id, stopId, req.user.branchIds);
  }

  @Patch(':id/stops/reorder')
  @UseGuards(JwtAuthGuard)
  @RequirePermission('orders.fulfill')
  reorderStops(@Request() req: any, @Param('id') id: string, @Body() dto: ReorderRouteStopsDto) {
    return this.deliveryRoutesService.reorderStops(id, dto, req.user.branchIds);
  }

  @Post(':id/assign-driver')
  @UseGuards(JwtAuthGuard)
  @RequirePermission('orders.fulfill')
  assignDriver(@Request() req: any, @Param('id') id: string, @Body() dto: AssignDriverDto) {
    return this.deliveryRoutesService.assignDriver(id, dto, req.user.userId, req.user.branchIds);
  }

  @Post(':id/start')
  @UseGuards(JwtAuthGuard)
  @RequirePermission('orders.fulfill')
  start(@Request() req: any, @Param('id') id: string) {
    return this.deliveryRoutesService.start(id, req.user.branchIds);
  }

  @Post(':id/stops/:stopId/complete')
  @UseGuards(JwtAuthGuard)
  @RequirePermission('orders.fulfill')
  completeStop(@Request() req: any, @Param('id') id: string, @Param('stopId') stopId: string) {
    return this.deliveryRoutesService.completeStop(id, stopId, req.user.userId, req.user.branchIds);
  }

  @Post(':id/stops/:stopId/fail')
  @UseGuards(JwtAuthGuard)
  @RequirePermission('orders.fulfill')
  failStop(@Request() req: any, @Param('id') id: string, @Param('stopId') stopId: string, @Body() dto: FailRouteStopDto) {
    return this.deliveryRoutesService.failStop(id, stopId, dto, req.user.branchIds);
  }

  @Post(':id/complete')
  @UseGuards(JwtAuthGuard)
  @RequirePermission('orders.fulfill')
  complete(@Request() req: any, @Param('id') id: string) {
    return this.deliveryRoutesService.complete(id, req.user.branchIds);
  }
}
