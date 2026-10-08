import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { CommerceModule } from '../commerce/commerce.module';
import { QueueModule } from '../queue/queue.module';
import { DeliveryProviderConfigModule } from './delivery-provider-config.module';
import { DeliveryRoutesService } from './delivery-routes.service';
import { DeliveryRoutesController } from './delivery-routes.controller';
import { DriversService } from './drivers.service';
import { DriversController } from './drivers.controller';
import { VehiclesService } from './vehicles.service';
import { VehiclesController } from './vehicles.controller';

@Module({
  imports: [PrismaModule, CommerceModule, QueueModule, DeliveryProviderConfigModule],
  controllers: [DeliveryRoutesController, DriversController, VehiclesController],
  providers: [DeliveryRoutesService, DriversService, VehiclesService],
  exports: [DeliveryRoutesService],
})
export class DeliveryModule {}
