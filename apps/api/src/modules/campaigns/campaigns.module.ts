import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { QueueModule } from '../queue/queue.module';
import { SegmentsController } from './segments.controller';
import { SegmentsService } from './segments.service';
import { CampaignsController } from './campaigns.controller';
import { CampaignsService } from './campaigns.service';

@Module({
  imports: [PrismaModule, QueueModule],
  controllers: [SegmentsController, CampaignsController],
  providers: [SegmentsService, CampaignsService],
})
export class CampaignsModule {}
