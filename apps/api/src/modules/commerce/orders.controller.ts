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
  list(@Query() query: ListOrdersQueryDto) {
    return this.ordersService.list(query);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @RequirePermission('orders.read')
  @HttpCode(200)
  findOne(@Param('id') id: string) {
    return this.ordersService.findOne(id);
  }

  @Get(':id/status-history')
  @UseGuards(JwtAuthGuard)
  @RequirePermission('orders.read')
  @HttpCode(200)
  listStatusHistory(@Param('id') id: string) {
    return this.ordersService.listStatusHistory(id);
  }

  @Post(':id/confirm')
  @UseGuards(JwtAuthGuard)
  @RequirePermission('orders.manage')
  confirm(@Request() req: any, @Param('id') id: string, @Body() dto: CancelOrderDto) {
    return this.ordersService.confirm(id, req.user.userId, dto.note);
  }

  @Post(':id/cancel')
  @UseGuards(JwtAuthGuard)
  @RequirePermission('orders.manage')
  cancel(@Request() req: any, @Param('id') id: string, @Body() dto: CancelOrderDto) {
    return this.ordersService.cancel(id, req.user.userId, dto);
  }

  @Post(':id/status')
  @UseGuards(JwtAuthGuard)
  @RequirePermission('orders.manage')
  setStatus(@Request() req: any, @Param('id') id: string, @Body() dto: UpdateOrderStatusDto) {
    return this.ordersService.setStatus(id, req.user.userId, dto);
  }

  @Post(':id/fulfillment')
  @UseGuards(JwtAuthGuard)
  @RequirePermission('orders.manage')
  updateFulfillment(@Param('id') id: string, @Body() dto: UpdateOrderFulfillmentDto) {
    return this.ordersService.updateFulfillment(id, dto);
  }

  @Post(':id/send-receipt')
  @UseGuards(JwtAuthGuard)
  @RequirePermission('orders.manage')
  @HttpCode(200)
  sendReceipt(@Request() req: any, @Param('id') id: string) {
    return this.ordersService.sendReceipt(id, req.user.userId);
  }

  @Patch(':id/tracking-code')
  @UseGuards(JwtAuthGuard)
  @RequirePermission('orders.manage')
  @HttpCode(200)
  updateTrackingCode(@Param('id') id: string, @Body() dto: UpdateOrderTrackingCodeDto) {
    return this.ordersService.updateTrackingCode(id, dto);
  }
}
