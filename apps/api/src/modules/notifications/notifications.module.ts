import { Global, Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';

// Global, same rationale as EventsModule: CommerceModule, BookingModule, and
// InternalActionsModule (workflow NOTIFY action) all need to create
// notifications without each one adding an explicit import.
@Global()
@Module({
  imports: [PrismaModule],
  controllers: [NotificationsController],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
