import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { StorageModule } from '../storage/storage.module';
import { PaymentMethodsController } from './payment-methods.controller';
import { PaymentMethodsService } from './payment-methods.service';

@Module({
  imports: [PrismaModule, StorageModule],
  controllers: [PaymentMethodsController],
  providers: [PaymentMethodsService],
  exports: [PaymentMethodsService],
})
export class PaymentsModule {}
