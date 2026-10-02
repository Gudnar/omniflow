import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ContactsModule } from '../contacts/contacts.module';
import { ConversationsModule } from '../conversations/conversations.module';
import { TemplatesModule } from '../templates/templates.module';
import { StorageModule } from '../storage/storage.module';
import { FacebookCommentsModule } from '../facebook-comments/facebook-comments.module';
import { MetaConnectionController } from './meta-connection.controller';
import { MetaConnectionService } from './meta-connection.service';
import { MetaWebhookController } from './meta-webhook.controller';
import { MetaWebhookService } from './meta-webhook.service';
import { TenantMetaAppController } from './tenant-meta-app.controller';
import { TenantMetaAppService } from './tenant-meta-app.service';

@Module({
  imports: [PrismaModule, ContactsModule, ConversationsModule, TemplatesModule, StorageModule, FacebookCommentsModule],
  controllers: [MetaConnectionController, MetaWebhookController, TenantMetaAppController],
  providers: [MetaConnectionService, MetaWebhookService, TenantMetaAppService],
})
export class MetaModule {}
