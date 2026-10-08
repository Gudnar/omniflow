import { Controller, Get, Post, Patch, Delete, Body, Param, Query, Request, UseGuards, HttpCode } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards';
import { RequirePermission } from '../auth/decorators';
import { VehiclesService } from './vehicles.service';
import { CreateVehicleDto, UpdateVehicleDto } from './vehicle.dto';

@Controller('delivery/vehicles')
export class VehiclesController {
  constructor(private vehiclesService: VehiclesService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  @RequirePermission('delivery.read')
  @HttpCode(200)
  list(@Query('branchId') branchId?: string) {
    return this.vehiclesService.list(branchId);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @RequirePermission('delivery.manage')
  create(@Request() req: any, @Body() dto: CreateVehicleDto) {
    return this.vehiclesService.create(req.user.tenantId, dto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @RequirePermission('delivery.manage')
  update(@Param('id') id: string, @Body() dto: UpdateVehicleDto) {
    return this.vehiclesService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @RequirePermission('delivery.manage')
  delete(@Param('id') id: string) {
    return this.vehiclesService.delete(id);
  }
}
