import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ContactsModule } from '../contacts/contacts.module';
import { ConversationsModule } from '../conversations/conversations.module';
import { TikTokConnectionController } from './tiktok-connection.controller';
import { TikTokConnectionService } from './tiktok-connection.service';
import { TikTokWebhookController } from './tiktok-webhook.controller';
import { TikTokWebhookService } from './tiktok-webhook.service';

@Module({
  imports: [PrismaModule, ContactsModule, ConversationsModule],
  controllers: [TikTokConnectionController, TikTokWebhookController],
  providers: [TikTokConnectionService, TikTokWebhookService],
})
export class TikTokModule {}
