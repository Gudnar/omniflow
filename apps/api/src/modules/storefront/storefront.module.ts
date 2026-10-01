import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { EcommerceModule } from '../ecommerce/ecommerce.module';
import { CommerceModule } from '../commerce/commerce.module';
import { BookingModule } from '../booking/booking.module';
import { PaymentsModule } from '../payments/payments.module';
import { StorageModule } from '../storage/storage.module';
import { StorefrontController } from './storefront.controller';
import { StorefrontService } from './storefront.service';
import { BookingStorefrontService } from './booking-storefront.service';

@Module({
  imports: [PrismaModule, EcommerceModule, CommerceModule, BookingModule, PaymentsModule, StorageModule],
  controllers: [StorefrontController],
  providers: [StorefrontService, BookingStorefrontService],
})
export class StorefrontModule {}
