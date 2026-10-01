import { Controller, Get, Post, Delete, Body, Param, UseGuards, Request, HttpCode } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards';
import { RequirePermission } from '../auth/decorators';
import { ActivitiesService } from './activities.service';
import { CreateActivityDto } from './dto/create-activity.dto';

@Controller('contacts/:contactId/activities')
export class ActivitiesController {
  constructor(private activitiesService: ActivitiesService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  @RequirePermission('contacts.read')
  @HttpCode(200)
  list(@Param('contactId') contactId: string) {
    return this.activitiesService.list(contactId);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @RequirePermission('contacts.manage')
  create(@Param('contactId') contactId: string, @Request() req: any, @Body() dto: CreateActivityDto) {
    return this.activitiesService.create(contactId, req.user.userId, dto);
  }

  @Delete(':activityId')
  @UseGuards(JwtAuthGuard)
  @RequirePermission('contacts.manage')
  @HttpCode(200)
  remove(@Param('contactId') contactId: string, @Param('activityId') activityId: string) {
    return this.activitiesService.remove(contactId, activityId);
  }
}
