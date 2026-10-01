import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { QueueModule } from '../queue/queue.module';
import { FacebookCommentsController } from './facebook-comments.controller';
import { FacebookCommentsService } from './facebook-comments.service';

@Module({
  imports: [PrismaModule, QueueModule],
  controllers: [FacebookCommentsController],
  providers: [FacebookCommentsService],
  exports: [FacebookCommentsService],
})
export class FacebookCommentsModule {}
