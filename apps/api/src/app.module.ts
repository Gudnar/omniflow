import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { HealthModule } from './modules/health/health.module';
import { PrismaModule } from './modules/prisma/prisma.module';
import { RedisModule } from './modules/redis/redis.module';
import { TenantContextModule } from './modules/tenant-context/tenant-context.module';
import { TenantsModule } from './modules/tenants/tenants.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { BranchesModule } from './modules/branches/branches.module';
import { CompaniesModule } from './modules/companies/companies.module';
import { TagsModule } from './modules/tags/tags.module';
import { ContactsModule } from './modules/contacts/contacts.module';
import { ConversationsModule } from './modules/conversations/conversations.module';
import { MetaModule } from './modules/meta/meta.module';
import { TikTokModule } from './modules/tiktok/tiktok.module';
import { EcommerceModule } from './modules/ecommerce/ecommerce.module';
import { CatalogModule } from './modules/catalog/catalog.module';
import { CommerceModule } from './modules/commerce/commerce.module';
import { BookingModule } from './modules/booking/booking.module';
import { EventsModule } from './modules/events/events.module';
import { InternalActionsModule } from './modules/internal-actions/internal-actions.module';
import { WorkflowsModule } from './modules/workflows/workflows.module';
import { TemplatesModule } from './modules/templates/templates.module';
import { CampaignsModule } from './modules/campaigns/campaigns.module';
import { StorefrontModule } from './modules/storefront/storefront.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { AiModule } from './modules/ai/ai.module';
import { KnowledgeModule } from './modules/knowledge/knowledge.module';
import { FacebookCommentsModule } from './modules/facebook-comments/facebook-comments.module';
import { LinkPageModule } from './modules/link-page/link-page.module';
import { RealtimeModule } from './modules/realtime/realtime.module';
import { WebchatModule } from './modules/webchat/webchat.module';
import { ConversationWindowModule } from './modules/conversation-window/conversation-window.module';
import { JwtAuthGuard, PermissionsGuard } from './modules/auth/guards';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    // Global, in-process, synchronous pub/sub — used solely to decouple
    // MessagesService from RealtimeGateway (see messages.service.ts's
    // 'message.created' emit). Not the same thing as EventsService, which
    // is the persisted, queue-backed workflow-automation event bus.
    EventEmitterModule.forRoot(),
    ThrottlerModule.forRoot([
      {
        name: 'short',
        ttl: 60000,
        limit: 10,
      },
    ]),
    TenantContextModule,
    TenantsModule,
    PrismaModule,
    RedisModule,
    HealthModule,
    AuthModule,
    UsersModule,
    BranchesModule,
    CompaniesModule,
    TagsModule,
    ContactsModule,
    ConversationsModule,
    MetaModule,
    TikTokModule,
    EcommerceModule,
    CatalogModule,
    CommerceModule,
    BookingModule,
    EventsModule,
    InternalActionsModule,
    WorkflowsModule,
    TemplatesModule,
    CampaignsModule,
    StorefrontModule,
    PaymentsModule,
    NotificationsModule,
    AiModule,
    KnowledgeModule,
    FacebookCommentsModule,
    LinkPageModule,
    RealtimeModule,
    WebchatModule,
    ConversationWindowModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: PermissionsGuard,
    },
  ],
})
export class AppModule {}
