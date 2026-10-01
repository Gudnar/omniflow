import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, HttpCode } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards';
import { RequirePermission } from '../auth/decorators';
import { BookingResourcesService } from './booking-resources.service';
import { CreateResourceDto, UpdateResourceDto, CreateScheduleEntryDto } from './dto/resource.dto';

@Controller('booking/resources')
export class BookingResourcesController {
  constructor(private resourcesService: BookingResourcesService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  @RequirePermission('booking.read')
  @HttpCode(200)
  list() {
    return this.resourcesService.list();
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @RequirePermission('booking.read')
  @HttpCode(200)
  findOne(@Param('id') id: string) {
    return this.resourcesService.findOne(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @RequirePermission('booking.manage')
  create(@Body() dto: CreateResourceDto) {
    return this.resourcesService.create(dto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @RequirePermission('booking.manage')
  update(@Param('id') id: string, @Body() dto: UpdateResourceDto) {
    return this.resourcesService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @RequirePermission('booking.manage')
  @HttpCode(200)
  remove(@Param('id') id: string) {
    return this.resourcesService.remove(id);
  }

  @Post(':id/services/:serviceId')
  @UseGuards(JwtAuthGuard)
  @RequirePermission('booking.manage')
  assignService(@Param('id') id: string, @Param('serviceId') serviceId: string) {
    return this.resourcesService.assignService(id, serviceId);
  }

  @Delete(':id/services/:serviceId')
  @UseGuards(JwtAuthGuard)
  @RequirePermission('booking.manage')
  @HttpCode(200)
  unassignService(@Param('id') id: string, @Param('serviceId') serviceId: string) {
    return this.resourcesService.unassignService(id, serviceId);
  }

  @Post(':id/schedule')
  @UseGuards(JwtAuthGuard)
  @RequirePermission('booking.manage')
  addScheduleEntry(@Param('id') id: string, @Body() dto: CreateScheduleEntryDto) {
    return this.resourcesService.addScheduleEntry(id, dto);
  }

  @Delete(':id/schedule/:entryId')
  @UseGuards(JwtAuthGuard)
  @RequirePermission('booking.manage')
  @HttpCode(200)
  removeScheduleEntry(@Param('id') id: string, @Param('entryId') entryId: string) {
    return this.resourcesService.removeScheduleEntry(id, entryId);
  }
}
