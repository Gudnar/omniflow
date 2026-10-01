import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, HttpCode } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards';
import { RequirePermission } from '../auth/decorators';
import { UserSchedulesService } from './user-schedules.service';
import { UpdateUserScheduleDto, CreateTimeOffDto } from './dto/user-schedule.dto';

@Controller('users/:userId')
export class UserSchedulesController {
  constructor(private userSchedulesService: UserSchedulesService) {}

  @Get('schedule')
  @UseGuards(JwtAuthGuard)
  @RequirePermission('booking.read')
  @HttpCode(200)
  getSchedule(@Param('userId') userId: string) {
    return this.userSchedulesService.getOrCreate(userId);
  }

  @Patch('schedule')
  @UseGuards(JwtAuthGuard)
  @RequirePermission('booking.manage')
  updateSchedule(@Param('userId') userId: string, @Body() dto: UpdateUserScheduleDto) {
    return this.userSchedulesService.updateIntervals(userId, dto);
  }

  @Get('time-off')
  @UseGuards(JwtAuthGuard)
  @RequirePermission('booking.read')
  @HttpCode(200)
  listTimeOff(@Param('userId') userId: string) {
    return this.userSchedulesService.listTimeOff(userId);
  }

  @Post('time-off')
  @UseGuards(JwtAuthGuard)
  @RequirePermission('booking.manage')
  addTimeOff(@Param('userId') userId: string, @Body() dto: CreateTimeOffDto) {
    return this.userSchedulesService.addTimeOff(userId, dto);
  }

  @Delete('time-off/:id')
  @UseGuards(JwtAuthGuard)
  @RequirePermission('booking.manage')
  @HttpCode(200)
  removeTimeOff(@Param('userId') userId: string, @Param('id') id: string) {
    return this.userSchedulesService.removeTimeOff(userId, id);
  }
}
