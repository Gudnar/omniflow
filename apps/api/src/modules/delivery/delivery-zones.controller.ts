import { Controller, Get, Post, Patch, Delete, Body, Param, Query, Request, UseGuards, HttpCode } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards';
import { RequirePermission } from '../auth/decorators';
import { DeliveryZonesService } from './delivery-zones.service';
import { CreateDeliveryZoneDto, UpdateDeliveryZoneDto } from './delivery-zone.dto';

@Controller('delivery/zones')
export class DeliveryZonesController {
  constructor(private deliveryZonesService: DeliveryZonesService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  @RequirePermission('delivery.read')
  @HttpCode(200)
  list(@Query('branchId') branchId: string) {
    return this.deliveryZonesService.list(branchId);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @RequirePermission('delivery.manage')
  create(@Request() req: any, @Body() dto: CreateDeliveryZoneDto) {
    return this.deliveryZonesService.create(req.user.tenantId, dto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @RequirePermission('delivery.manage')
  update(@Param('id') id: string, @Body() dto: UpdateDeliveryZoneDto) {
    return this.deliveryZonesService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @RequirePermission('delivery.manage')
  delete(@Param('id') id: string) {
    return this.deliveryZonesService.delete(id);
  }
}
