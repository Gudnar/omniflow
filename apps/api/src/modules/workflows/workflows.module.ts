import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { QueueModule } from '../queue/queue.module';
import { FlowsController, FlowExecutionsController } from './flows.controller';
import { FlowsService } from './flows.service';

@Module({
  imports: [PrismaModule, QueueModule],
  controllers: [FlowsController, FlowExecutionsController],
  providers: [FlowsService],
})
export class WorkflowsModule {}
