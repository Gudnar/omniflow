import { Controller, Get, Post, Patch, Delete, Body, Param, Query, Request, UseGuards, HttpCode } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards';
import { RequirePermission } from '../auth/decorators';
import { DeliveryZonesService } from './delivery-zones.service';
import {
  CreateDeliveryZoneDto,
  UpdateDeliveryZoneDto,
  CreateRateProfileDto,
  UpdateRateProfileDto,
} from './delivery-zone.dto';

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

  // ---- Tarifas especiales (solo zonas DISTANCE_TIERS) ---------------------

  @Get(':zoneId/rate-profiles')
  @UseGuards(JwtAuthGuard)
  @RequirePermission('delivery.read')
  @HttpCode(200)
  listRateProfiles(@Param('zoneId') zoneId: string) {
    return this.deliveryZonesService.listRateProfiles(zoneId);
  }

  @Post(':zoneId/rate-profiles')
  @UseGuards(JwtAuthGuard)
  @RequirePermission('delivery.manage')
  createRateProfile(@Param('zoneId') zoneId: string, @Body() dto: CreateRateProfileDto) {
    return this.deliveryZonesService.createRateProfile(zoneId, dto);
  }

  @Patch(':zoneId/rate-profiles/:id')
  @UseGuards(JwtAuthGuard)
  @RequirePermission('delivery.manage')
  updateRateProfile(@Param('id') id: string, @Body() dto: UpdateRateProfileDto) {
    return this.deliveryZonesService.updateRateProfile(id, dto);
  }

  @Post(':zoneId/rate-profiles/:id/activate')
  @UseGuards(JwtAuthGuard)
  @RequirePermission('delivery.manage')
  activateRateProfile(@Param('zoneId') zoneId: string, @Param('id') id: string) {
    return this.deliveryZonesService.activateRateProfile(zoneId, id);
  }

  @Delete(':zoneId/rate-profiles/:id')
  @UseGuards(JwtAuthGuard)
  @RequirePermission('delivery.manage')
  deleteRateProfile(@Param('id') id: string) {
    return this.deliveryZonesService.deleteRateProfile(id);
  }
}
