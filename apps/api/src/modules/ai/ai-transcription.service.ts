import { Injectable } from '@nestjs/common';
import { logger } from '@omniflow/utils';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContextService } from '../tenant-context/tenant-context.service';
import { TranscriptionAdapter } from './providers/transcription.adapter';
import { AiReplyService } from './ai-reply.service';

// Phase 26: Voice/audio transcription — invoked from
// InternalAiActionsController, enqueued by apps/worker off the hot webhook
// path (same "queue → worker → internal callback" shape as AiReplyService
// itself). Fills in the AUDIO message's transcript, then hands off to the
// exact same AiReplyService.generateReply() a TEXT message would use —
// escalation keywords, RAG, history, all of it "just works" once content is
// real text.
@Injectable()
export class AiTranscriptionService {
  constructor(
    private prisma: PrismaService,
    private tenantContext: TenantContextService,
    private transcriptionAdapter: TranscriptionAdapter,
    private aiReplyService: AiReplyService,
  ) {}

  async transcribeAndReply(tenantId: string, messageId: string): Promise<void> {
    this.tenantContext.setContext({ tenantId });

    const message = await this.prisma.client.message.findUnique({
      where: { id: messageId },
      include: { attachments: true },
    });
    if (!message || message.type !== 'AUDIO') return;

    const attachment = message.attachments[0];
    if (!attachment) {
      logger.error('Transcription skipped: AUDIO message has no attachment', undefined, { messageId });
      return;
    }

    const audioResponse = await fetch(attachment.url);
    if (!audioResponse.ok) {
      logger.error('Transcription skipped: could not download stored audio', undefined, {
        messageId,
        url: attachment.url,
        status: audioResponse.status,
      });
      return;
    }
    const buffer = Buffer.from(await audioResponse.arrayBuffer());

    const transcript = await this.transcriptionAdapter.transcribe(buffer, attachment.fileName, attachment.mimeType);

    await this.prisma.client.message.update({
      where: { id: messageId },
      data: { content: transcript.trim() || '[Audio sin contenido reconocible]' },
    });

    await this.aiReplyService.generateReply(tenantId, message.conversationId, messageId);
  }
}
