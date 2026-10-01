import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { QueueModule } from '../queue/queue.module';
import { ConversationsModule } from '../conversations/conversations.module';
import { ContactsModule } from '../contacts/contacts.module';
import { CommerceModule } from '../commerce/commerce.module';
import { BookingModule } from '../booking/booking.module';
import { TemplatesModule } from '../templates/templates.module';
import { InternalApiKeyGuard } from './internal-api-key.guard';
import { InternalFlowActionsController } from './internal-flow-actions.controller';

@Module({
  imports: [PrismaModule, QueueModule, ConversationsModule, ContactsModule, CommerceModule, BookingModule, TemplatesModule],
  controllers: [InternalFlowActionsController],
  providers: [InternalApiKeyGuard],
})
export class InternalActionsModule {}
