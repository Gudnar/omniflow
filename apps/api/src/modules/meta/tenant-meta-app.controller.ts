import { Controller, Get, Post, Delete, Body, Request, UseGuards, HttpCode } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards';
import { RequirePermission } from '../auth/decorators';
import { TenantMetaAppService } from './tenant-meta-app.service';
import { ConnectMetaAppDto } from './dto/connect-meta-app.dto';

@Controller('channels/meta-app')
@UseGuards(JwtAuthGuard)
export class TenantMetaAppController {
  constructor(private tenantMetaAppService: TenantMetaAppService) {}

  @Post()
  @RequirePermission('channels.manage')
  connect(@Request() req: any, @Body() dto: ConnectMetaAppDto) {
    return this.tenantMetaAppService.connect(req.user.tenantId, dto);
  }

  @Get()
  @RequirePermission('channels.read')
  @HttpCode(200)
  get(@Request() req: any) {
    return this.tenantMetaAppService.get(req.user.tenantId);
  }

  @Delete()
  @RequirePermission('channels.manage')
  @HttpCode(200)
  disconnect(@Request() req: any) {
    return this.tenantMetaAppService.disconnect(req.user.tenantId);
  }
}
