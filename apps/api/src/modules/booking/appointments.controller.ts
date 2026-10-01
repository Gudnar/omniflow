import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards, Request, HttpCode } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards';
import { RequirePermission } from '../auth/decorators';
import { AppointmentsService } from './appointments.service';
import {
  AvailabilityQueryDto,
  CreateAppointmentDto,
  RescheduleAppointmentDto,
  ListAppointmentsQueryDto,
  UpdateAppointmentStatusDto,
  CancelAppointmentDto,
} from './dto/appointment.dto';

@Controller('booking/availability')
export class BookingAvailabilityController {
  constructor(private appointmentsService: AppointmentsService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  @RequirePermission('appointments.read')
  @HttpCode(200)
  getAvailability(@Query() query: AvailabilityQueryDto) {
    return this.appointmentsService.getAvailability(query);
  }
}

@Controller('appointments')
export class AppointmentsController {
  constructor(private appointmentsService: AppointmentsService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  @RequirePermission('appointments.read')
  @HttpCode(200)
  list(@Query() query: ListAppointmentsQueryDto) {
    return this.appointmentsService.list(query);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @RequirePermission('appointments.read')
  @HttpCode(200)
  findOne(@Param('id') id: string) {
    return this.appointmentsService.findOne(id);
  }

  @Get(':id/status-history')
  @UseGuards(JwtAuthGuard)
  @RequirePermission('appointments.read')
  @HttpCode(200)
  listStatusHistory(@Param('id') id: string) {
    return this.appointmentsService.listStatusHistory(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @RequirePermission('appointments.manage')
  create(@Body() dto: CreateAppointmentDto) {
    return this.appointmentsService.create(dto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @RequirePermission('appointments.manage')
  reschedule(@Param('id') id: string, @Body() dto: RescheduleAppointmentDto) {
    return this.appointmentsService.reschedule(id, dto);
  }

  @Post(':id/cancel')
  @UseGuards(JwtAuthGuard)
  @RequirePermission('appointments.manage')
  cancel(@Request() req: any, @Param('id') id: string, @Body() dto: CancelAppointmentDto) {
    return this.appointmentsService.cancel(id, req.user.userId, dto);
  }

  @Post(':id/status')
  @UseGuards(JwtAuthGuard)
  @RequirePermission('appointments.manage')
  setStatus(@Request() req: any, @Param('id') id: string, @Body() dto: UpdateAppointmentStatusDto) {
    return this.appointmentsService.setStatus(id, req.user.userId, dto);
  }
}
