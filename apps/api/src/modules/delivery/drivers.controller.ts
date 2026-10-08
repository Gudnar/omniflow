import { Controller, Get, Post, Patch, Delete, Body, Param, Query, Request, UseGuards, HttpCode } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards';
import { RequirePermission } from '../auth/decorators';
import { DriversService } from './drivers.service';
import { CreateDriverDto, UpdateDriverDto } from './driver.dto';

@Controller('delivery/drivers')
export class DriversController {
  constructor(private driversService: DriversService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  @RequirePermission('delivery.read')
  @HttpCode(200)
  list(@Query('branchId') branchId?: string) {
    return this.driversService.list(branchId);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @RequirePermission('delivery.manage')
  create(@Request() req: any, @Body() dto: CreateDriverDto) {
    return this.driversService.create(req.user.tenantId, dto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @RequirePermission('delivery.manage')
  update(@Param('id') id: string, @Body() dto: UpdateDriverDto) {
    return this.driversService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @RequirePermission('delivery.manage')
  delete(@Param('id') id: string) {
    return this.driversService.delete(id);
  }
}
