import { Controller, Get, Post, Delete, Body, UseGuards, Request, HttpCode } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards';
import { RequirePermission } from '../auth/decorators';
import { TikTokConnectionService } from './tiktok-connection.service';
import { ConnectTikTokDto } from './dto/connect-tiktok.dto';

@Controller('channels/tiktok')
export class TikTokConnectionController {
  constructor(private tikTokConnectionService: TikTokConnectionService) {}

  @Post('connect')
  @UseGuards(JwtAuthGuard)
  @RequirePermission('channels.manage')
  connect(@Request() req: any, @Body() dto: ConnectTikTokDto) {
    return this.tikTokConnectionService.connect(req.user.tenantId, dto);
  }

  @Post('test')
  @UseGuards(JwtAuthGuard)
  @RequirePermission('channels.manage')
  @HttpCode(200)
  test(@Request() req: any, @Body() dto: ConnectTikTokDto) {
    return this.tikTokConnectionService.testConnection(req.user.tenantId, dto);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @RequirePermission('channels.read')
  @HttpCode(200)
  get(@Request() req: any) {
    return this.tikTokConnectionService.get(req.user.tenantId);
  }

  @Delete()
  @UseGuards(JwtAuthGuard)
  @RequirePermission('channels.manage')
  @HttpCode(200)
  disconnect(@Request() req: any) {
    return this.tikTokConnectionService.disconnect(req.user.tenantId);
  }
}
