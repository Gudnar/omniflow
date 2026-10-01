import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ContactsModule } from '../contacts/contacts.module';
import { QueueModule } from '../queue/queue.module';
import { ConversationsController } from './conversations.controller';
import { ConversationsService } from './conversations.service';
import { MessagesController } from './messages.controller';
import { MessagesService } from './messages.service';

@Module({
  imports: [PrismaModule, ContactsModule, QueueModule],
  controllers: [ConversationsController, MessagesController],
  providers: [ConversationsService, MessagesService],
  exports: [ConversationsService, MessagesService],
})
export class ConversationsModule {}
