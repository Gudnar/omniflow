import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { StorageModule } from '../storage/storage.module';
import { TenantsController } from './tenants.controller';
import { TenantsService } from './tenants.service';

@Module({
  imports: [PrismaModule, StorageModule],
  controllers: [TenantsController],
  providers: [TenantsService],
})
export class TenantsModule {}
