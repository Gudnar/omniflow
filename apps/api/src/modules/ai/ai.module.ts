import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ConversationsModule } from '../conversations/conversations.module';
import { KnowledgeModule } from '../knowledge/knowledge.module';
import { CommerceModule } from '../commerce/commerce.module';
import { BookingModule } from '../booking/booking.module';
import { DeliveryZonesModule } from '../delivery/delivery-zones.module';
import { AiCatalogController } from './ai-catalog.controller';
import { AiCatalogService } from './ai-catalog.service';
import { AiAgentsController } from './ai-agents.controller';
import { AiAgentsService } from './ai-agents.service';
import { AiUsageController } from './ai-usage.controller';
import { AiUsageService } from './ai-usage.service';
import { AiReplyService } from './ai-reply.service';
import { AiCredentialsService } from './ai-credentials.service';
import { AiTranscriptionService } from './ai-transcription.service';
import { InternalAiActionsController } from './internal-ai-actions.controller';
import { OpenAiAdapter } from './providers/openai.adapter';
import { AnthropicAdapter } from './providers/anthropic.adapter';
import { GeminiAdapter } from './providers/gemini.adapter';
import { DeepSeekAdapter } from './providers/deepseek.adapter';
import { TranscriptionAdapter } from './providers/transcription.adapter';
import { InternalApiKeyGuard } from '../internal-actions/internal-api-key.guard';
import { AiToolsService } from './tools/ai-tools.service';

@Module({
  imports: [PrismaModule, ConversationsModule, KnowledgeModule, CommerceModule, BookingModule, DeliveryZonesModule],
  controllers: [AiCatalogController, AiAgentsController, AiUsageController, InternalAiActionsController],
  providers: [
    AiCatalogService,
    AiAgentsService,
    AiUsageService,
    AiReplyService,
    AiCredentialsService,
    AiTranscriptionService,
    AiToolsService,
    OpenAiAdapter,
    AnthropicAdapter,
    GeminiAdapter,
    DeepSeekAdapter,
    TranscriptionAdapter,
    InternalApiKeyGuard,
  ],
})
export class AiModule {}
