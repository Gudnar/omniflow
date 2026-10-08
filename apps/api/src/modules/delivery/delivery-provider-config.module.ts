import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { DeliveryProviderConfigService } from './delivery-provider-config.service';
import { DeliveryProviderConfigController } from './delivery-provider-config.controller';

// Standalone — same rationale as DeliveryZonesModule: CommerceModule
// (OrdersService/CartsService) and DeliveryModule (DeliveryRoutesService)
// both need this service, and DeliveryModule already imports CommerceModule
// (for OrdersService), so this can't live inside DeliveryModule without a
// circular module graph.
@Module({
  imports: [PrismaModule],
  controllers: [DeliveryProviderConfigController],
  providers: [DeliveryProviderConfigService],
  exports: [DeliveryProviderConfigService],
})
export class DeliveryProviderConfigModule {}
