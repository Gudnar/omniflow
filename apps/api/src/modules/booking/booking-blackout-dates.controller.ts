import { Controller, Get, Post, Delete, Body, Param, Query, UseGuards, HttpCode } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards';
import { RequirePermission } from '../auth/decorators';
import { BookingBlackoutDatesService } from './booking-blackout-dates.service';
import { ListBlackoutDatesQueryDto, CreateBlackoutDateDto } from './dto/blackout-date.dto';

@Controller('booking/blackout-dates')
export class BookingBlackoutDatesController {
  constructor(private blackoutDatesService: BookingBlackoutDatesService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  @RequirePermission('appointments.manage')
  @HttpCode(200)
  list(@Query() query: ListBlackoutDatesQueryDto) {
    return this.blackoutDatesService.list(query.branchId);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @RequirePermission('appointments.manage')
  create(@Body() dto: CreateBlackoutDateDto) {
    return this.blackoutDatesService.create(dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @RequirePermission('appointments.manage')
  @HttpCode(200)
  remove(@Param('id') id: string) {
    return this.blackoutDatesService.remove(id);
  }
}
