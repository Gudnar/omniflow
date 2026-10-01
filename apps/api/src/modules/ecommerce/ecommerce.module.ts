import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { StorageModule } from '../storage/storage.module';
import { EcommerceController } from './ecommerce.controller';
import { EcommerceStoreService } from './ecommerce-store.service';
import { EcommerceSettingsService } from './ecommerce-settings.service';
import { EcommerceSectionsService } from './ecommerce-sections.service';

@Module({
  imports: [PrismaModule, StorageModule],
  controllers: [EcommerceController],
  providers: [EcommerceStoreService, EcommerceSettingsService, EcommerceSectionsService],
  exports: [EcommerceStoreService],
})
export class EcommerceModule {}
