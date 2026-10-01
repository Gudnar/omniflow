import { Controller, Get, Post, Delete, Body, UseGuards, Request, HttpCode } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards';
import { RequirePermission } from '../auth/decorators';
import { MetaConnectionService } from './meta-connection.service';
import { ConnectMetaDto } from './dto/connect-meta.dto';

@Controller('channels')
export class MetaConnectionController {
  constructor(private metaConnectionService: MetaConnectionService) {}

  // --- WhatsApp ---

  @Post('whatsapp/connect')
  @UseGuards(JwtAuthGuard)
  @RequirePermission('channels.manage')
  connectWhatsapp(@Request() req: any, @Body() dto: ConnectMetaDto) {
    return this.metaConnectionService.connect(req.user.tenantId, 'WHATSAPP', dto);
  }

  @Post('whatsapp/test')
  @UseGuards(JwtAuthGuard)
  @RequirePermission('channels.manage')
  @HttpCode(200)
  testWhatsapp(@Request() req: any, @Body() dto: ConnectMetaDto) {
    return this.metaConnectionService.testConnection(req.user.tenantId, 'WHATSAPP', dto);
  }

  @Get('whatsapp')
  @UseGuards(JwtAuthGuard)
  @RequirePermission('channels.read')
  @HttpCode(200)
  getWhatsapp(@Request() req: any) {
    return this.metaConnectionService.get(req.user.tenantId, 'WHATSAPP');
  }

  @Delete('whatsapp')
  @UseGuards(JwtAuthGuard)
  @RequirePermission('channels.manage')
  @HttpCode(200)
  disconnectWhatsapp(@Request() req: any) {
    return this.metaConnectionService.disconnect(req.user.tenantId, 'WHATSAPP');
  }

  // --- Instagram ---

  @Post('instagram/connect')
  @UseGuards(JwtAuthGuard)
  @RequirePermission('channels.manage')
  connectInstagram(@Request() req: any, @Body() dto: ConnectMetaDto) {
    return this.metaConnectionService.connect(req.user.tenantId, 'INSTAGRAM', dto);
  }

  @Post('instagram/test')
  @UseGuards(JwtAuthGuard)
  @RequirePermission('channels.manage')
  @HttpCode(200)
  testInstagram(@Request() req: any, @Body() dto: ConnectMetaDto) {
    return this.metaConnectionService.testConnection(req.user.tenantId, 'INSTAGRAM', dto);
  }

  @Get('instagram')
  @UseGuards(JwtAuthGuard)
  @RequirePermission('channels.read')
  @HttpCode(200)
  getInstagram(@Request() req: any) {
    return this.metaConnectionService.get(req.user.tenantId, 'INSTAGRAM');
  }

  @Delete('instagram')
  @UseGuards(JwtAuthGuard)
  @RequirePermission('channels.manage')
  @HttpCode(200)
  disconnectInstagram(@Request() req: any) {
    return this.metaConnectionService.disconnect(req.user.tenantId, 'INSTAGRAM');
  }

  // --- Facebook (Messenger DMs — stored internally as Channel.MESSENGER;
  // the route stays "facebook" to match Meta's own product branding for the
  // Page connection, see meta-webhook.service.ts for the same mapping). ---

  @Post('facebook/connect')
  @UseGuards(JwtAuthGuard)
  @RequirePermission('channels.manage')
  connectFacebook(@Request() req: any, @Body() dto: ConnectMetaDto) {
    return this.metaConnectionService.connect(req.user.tenantId, 'MESSENGER', dto);
  }

  @Post('facebook/test')
  @UseGuards(JwtAuthGuard)
  @RequirePermission('channels.manage')
  @HttpCode(200)
  testFacebook(@Request() req: any, @Body() dto: ConnectMetaDto) {
    return this.metaConnectionService.testConnection(req.user.tenantId, 'MESSENGER', dto);
  }

  @Get('facebook')
  @UseGuards(JwtAuthGuard)
  @RequirePermission('channels.read')
  @HttpCode(200)
  getFacebook(@Request() req: any) {
    return this.metaConnectionService.get(req.user.tenantId, 'MESSENGER');
  }

  @Delete('facebook')
  @UseGuards(JwtAuthGuard)
  @RequirePermission('channels.manage')
  @HttpCode(200)
  disconnectFacebook(@Request() req: any) {
    return this.metaConnectionService.disconnect(req.user.tenantId, 'MESSENGER');
  }

  // --- Facebook Page comments (Phase 27 — separate from Messenger DMs
  // above: same underlying Page, but a tenant connects/disconnects
  // comment-replying independently, stored as Channel.FACEBOOK). ---

  @Post('facebook-comments/connect')
  @UseGuards(JwtAuthGuard)
  @RequirePermission('channels.manage')
  connectFacebookComments(@Request() req: any, @Body() dto: ConnectMetaDto) {
    return this.metaConnectionService.connect(req.user.tenantId, 'FACEBOOK', dto);
  }

  @Post('facebook-comments/test')
  @UseGuards(JwtAuthGuard)
  @RequirePermission('channels.manage')
  @HttpCode(200)
  testFacebookComments(@Request() req: any, @Body() dto: ConnectMetaDto) {
    return this.metaConnectionService.testConnection(req.user.tenantId, 'FACEBOOK', dto);
  }

  @Get('facebook-comments')
  @UseGuards(JwtAuthGuard)
  @RequirePermission('channels.read')
  @HttpCode(200)
  getFacebookComments(@Request() req: any) {
    return this.metaConnectionService.get(req.user.tenantId, 'FACEBOOK');
  }

  @Delete('facebook-comments')
  @UseGuards(JwtAuthGuard)
  @RequirePermission('channels.manage')
  @HttpCode(200)
  disconnectFacebookComments(@Request() req: any) {
    return this.metaConnectionService.disconnect(req.user.tenantId, 'FACEBOOK');
  }
}
