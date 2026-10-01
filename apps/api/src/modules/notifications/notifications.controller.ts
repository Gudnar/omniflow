import { Controller, Get, Post, Param, Query, UseGuards, Request, HttpCode } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private notificationsService: NotificationsService) {}

  @Get()
  @HttpCode(200)
  list(@Request() req: any, @Query('unreadOnly') unreadOnly?: string) {
    return this.notificationsService.list(req.user.userId, { unreadOnly: unreadOnly === 'true' });
  }

  @Get('unread-count')
  @HttpCode(200)
  async unreadCount(@Request() req: any) {
    const count = await this.notificationsService.unreadCount(req.user.userId);
    return { count };
  }

  @Post(':id/read')
  @HttpCode(200)
  markRead(@Request() req: any, @Param('id') id: string) {
    return this.notificationsService.markRead(id, req.user.userId);
  }

  @Post('read-all')
  @HttpCode(200)
  markAllRead(@Request() req: any) {
    return this.notificationsService.markAllRead(req.user.userId);
  }
}
