import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ContactsModule } from '../contacts/contacts.module';
import { ConversationsModule } from '../conversations/conversations.module';
import { WebchatController } from './webchat.controller';
import { WebchatService } from './webchat.service';

@Module({
  imports: [PrismaModule, ContactsModule, ConversationsModule],
  controllers: [WebchatController],
  providers: [WebchatService],
})
export class WebchatModule {}
