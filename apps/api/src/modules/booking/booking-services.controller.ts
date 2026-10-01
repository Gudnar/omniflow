import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, HttpCode } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards';
import { RequirePermission } from '../auth/decorators';
import { BookingServicesService } from './booking-services.service';
import { CreateServiceDto, UpdateServiceDto } from './dto/service.dto';

@Controller('booking/services')
export class BookingServicesController {
  constructor(private servicesService: BookingServicesService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  @RequirePermission('booking.read')
  @HttpCode(200)
  list() {
    return this.servicesService.list();
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @RequirePermission('booking.read')
  @HttpCode(200)
  findOne(@Param('id') id: string) {
    return this.servicesService.findOne(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @RequirePermission('booking.manage')
  create(@Body() dto: CreateServiceDto) {
    return this.servicesService.create(dto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @RequirePermission('booking.manage')
  update(@Param('id') id: string, @Body() dto: UpdateServiceDto) {
    return this.servicesService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @RequirePermission('booking.manage')
  @HttpCode(200)
  remove(@Param('id') id: string) {
    return this.servicesService.remove(id);
  }

  @Post(':id/staff/:userId')
  @UseGuards(JwtAuthGuard)
  @RequirePermission('booking.manage')
  addStaff(@Param('id') id: string, @Param('userId') userId: string) {
    return this.servicesService.addQualifiedStaff(id, userId);
  }

  @Delete(':id/staff/:userId')
  @UseGuards(JwtAuthGuard)
  @RequirePermission('booking.manage')
  @HttpCode(200)
  removeStaff(@Param('id') id: string, @Param('userId') userId: string) {
    return this.servicesService.removeQualifiedStaff(id, userId);
  }
}
