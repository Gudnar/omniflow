import { Controller, Get, Post, Delete, Body, Query, Request, UseGuards, HttpCode } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards';
import { RequirePermission } from '../auth/decorators';
import { DeliveryProviderConfigService } from './delivery-provider-config.service';
import { UpsertDeliveryProviderConfigDto } from './delivery-provider-config.dto';

@Controller('delivery/provider-config')
export class DeliveryProviderConfigController {
  constructor(private deliveryProviderConfigService: DeliveryProviderConfigService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  @RequirePermission('delivery.read')
  @HttpCode(200)
  list(@Request() req: any) {
    return this.deliveryProviderConfigService.list(req.user.tenantId);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @RequirePermission('delivery.manage')
  upsert(@Request() req: any, @Body() dto: UpsertDeliveryProviderConfigDto) {
    return this.deliveryProviderConfigService.upsert(req.user.tenantId, dto);
  }

  @Delete()
  @UseGuards(JwtAuthGuard)
  @RequirePermission('delivery.manage')
  delete(@Request() req: any, @Query('branchId') branchId?: string) {
    return this.deliveryProviderConfigService.delete(req.user.tenantId, branchId);
  }
}
