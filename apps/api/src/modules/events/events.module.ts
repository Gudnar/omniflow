import { Global, Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { QueueModule } from '../queue/queue.module';
import { EventsService } from './events.service';

// Global: every domain module (contacts, commerce, booking, ...) needs to
// emit events without each one adding an explicit import, mirroring
// TenantContextModule's own @Global() rationale.
@Global()
@Module({
  imports: [PrismaModule, QueueModule],
  providers: [EventsService],
  exports: [EventsService],
})
export class EventsModule {}
