import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ConversationsModule } from '../conversations/conversations.module';
import { ConversationWindowController } from './conversation-window.controller';
import { ConversationWindowService } from './conversation-window.service';

@Module({
  imports: [PrismaModule, ConversationsModule],
  controllers: [ConversationWindowController],
  providers: [ConversationWindowService],
})
export class ConversationWindowModule {}
