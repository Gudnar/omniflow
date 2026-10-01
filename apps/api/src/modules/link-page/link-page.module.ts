import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { StorageModule } from '../storage/storage.module';
import { LinkPageController } from './link-page.controller';
import { LinkPagePublicController } from './link-page-public.controller';
import { LinkPageService } from './link-page.service';

@Module({
  imports: [PrismaModule, StorageModule],
  controllers: [LinkPageController, LinkPagePublicController],
  providers: [LinkPageService],
})
export class LinkPageModule {}
