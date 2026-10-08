import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards, Request, HttpCode } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards';
import { RequirePermission } from '../auth/decorators';
import { OrdersService } from './orders.service';
import {
  ListOrdersQueryDto,
  UpdateOrderStatusDto,
  CancelOrderDto,
  UpdateOrderFulfillmentDto,
  UpdateOrderTrackingCodeDto,
} from './dto/order.dto';

@Controller('orders')
export class OrdersController {
  constructor(private ordersService: OrdersService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  @RequirePermission('orders.read')
  @HttpCode(200)
  list(@Request() req: any, @Query() query: ListOrdersQueryDto) {
    return this.ordersService.list(query, req.user.branchIds);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @RequirePermission('orders.read')
  @HttpCode(200)
  findOne(@Request() req: any, @Param('id') id: string) {
    return this.ordersService.findOne(id, req.user.branchIds);
  }

  @Get(':id/status-history')
  @UseGuards(JwtAuthGuard)
  @RequirePermission('orders.read')
  @HttpCode(200)
  listStatusHistory(@Request() req: any, @Param('id') id: string) {
    return this.ordersService.listStatusHistory(id, req.user.branchIds);
  }

  @Post(':id/confirm')
  @UseGuards(JwtAuthGuard)
  @RequirePermission('orders.approve')
  confirm(@Request() req: any, @Param('id') id: string, @Body() dto: CancelOrderDto) {
    return this.ordersService.confirm(id, req.user.userId, dto.note, req.user.branchIds);
  }

  @Post(':id/cancel')
  @UseGuards(JwtAuthGuard)
  @RequirePermission('orders.cancel')
  cancel(@Request() req: any, @Param('id') id: string, @Body() dto: CancelOrderDto) {
    return this.ordersService.cancel(id, req.user.userId, dto, req.user.branchIds);
  }

  // The generic "set any status" door stays behind the full orders.manage
  // permission on purpose — it can also move an order to CONFIRMED/CANCELLED,
  // so gating it behind the narrower approve/cancel permissions would let
  // someone with only one of those bypass the other through this endpoint.
  @Post(':id/status')
  @UseGuards(JwtAuthGuard)
  @RequirePermission('orders.manage')
  setStatus(@Request() req: any, @Param('id') id: string, @Body() dto: UpdateOrderStatusDto) {
    return this.ordersService.setStatus(id, req.user.userId, dto, req.user.branchIds);
  }

  @Post(':id/fulfillment')
  @UseGuards(JwtAuthGuard)
  @RequirePermission('orders.fulfill')
  updateFulfillment(@Request() req: any, @Param('id') id: string, @Body() dto: UpdateOrderFulfillmentDto) {
    return this.ordersService.updateFulfillment(id, dto, req.user.branchIds);
  }

  @Post(':id/send-receipt')
  @UseGuards(JwtAuthGuard)
  @RequirePermission('orders.fulfill')
  @HttpCode(200)
  sendReceipt(@Request() req: any, @Param('id') id: string) {
    return this.ordersService.sendReceipt(id, req.user.userId, req.user.branchIds);
  }

  @Patch(':id/tracking-code')
  @UseGuards(JwtAuthGuard)
  @RequirePermission('orders.fulfill')
  @HttpCode(200)
  updateTrackingCode(@Request() req: any, @Param('id') id: string, @Body() dto: UpdateOrderTrackingCodeDto) {
    return this.ordersService.updateTrackingCode(id, dto, req.user.branchIds);
  }
}
