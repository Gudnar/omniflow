import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { Public } from '../auth/decorators';
import { InternalApiKeyGuard } from '../internal-actions/internal-api-key.guard';
import { AiReplyService } from './ai-reply.service';
import { AiTranscriptionService } from './ai-transcription.service';
import { InternalAiReplyDto } from './dto/internal-ai-reply.dto';
import { InternalTranscribeDto } from './dto/internal-transcribe.dto';

// Same shape as InternalFlowActionsController: @Public() bypasses the global
// JwtAuthGuard (server-to-server call from apps/worker, no end-user
// session), InternalApiKeyGuard's shared secret is the only auth layer.
@Controller('internal/ai')
@Public()
@UseGuards(InternalApiKeyGuard)
export class InternalAiActionsController {
  constructor(
    private aiReplyService: AiReplyService,
    private aiTranscriptionService: AiTranscriptionService,
  ) {}

  @Post('reply')
  async reply(@Body() dto: InternalAiReplyDto) {
    await this.aiReplyService.generateReply(dto.tenantId, dto.conversationId, dto.messageId);
    return { success: true };
  }

  @Post('transcribe')
  async transcribe(@Body() dto: InternalTranscribeDto) {
    await this.aiTranscriptionService.transcribeAndReply(dto.tenantId, dto.messageId);
    return { success: true };
  }
}
