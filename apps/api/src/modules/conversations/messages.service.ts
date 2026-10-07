import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service';
import { ConversationsService } from './conversations.service';
import { QueueService } from '../queue/queue.service';
import { EventsService } from '../events/events.service';
import { ValidationError } from '@omniflow/utils';
import { CreateMessageDto } from './dto/create-message.dto';
import { SendQuickRepliesDto, SendFormDto } from './dto/interactive-message.dto';

@Injectable()
export class MessagesService {
  constructor(
    private prisma: PrismaService,
    private conversationsService: ConversationsService,
    private queueService: QueueService,
    private eventsService: EventsService,
    // In-process only, synchronous — deliberately NOT EventsService (that one
    // persists an Event row and round-trips through a BullMQ worker for the
    // workflow engine, far too slow for "push this to an open socket now").
    private eventEmitter: EventEmitter2,
  ) {}

  async list(conversationId: string) {
    await this.conversationsService.findOne(conversationId);
    return this.prisma.client.message.findMany({
      where: { conversationId },
      include: { attachments: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  async create(conversationId: string, actorUserId: string, dto: CreateMessageDto) {
    const conversation = await this.conversationsService.findOne(conversationId);

    const type = dto.type ?? 'TEXT';
    if (dto.direction === 'INBOUND' && type === 'NOTE') {
      throw new ValidationError('NOTE messages must be OUTBOUND');
    }

    const senderId = dto.direction === 'OUTBOUND' ? actorUserId : null;

    const message = await this.prisma.client.$transaction(async (tx: any) => {
      const created = await tx.message.create({
        data: {
          conversationId,
          direction: dto.direction,
          type,
          content: dto.content,
          senderId,
          externalId: dto.externalId,
          ctaPayload: dto.ctaPayload,
          interactivePayload: dto.interactivePayload,
        },
      });

      if (dto.attachmentUrl) {
        await tx.attachment.create({
          data: {
            messageId: created.id,
            url: dto.attachmentUrl,
            mimeType: dto.attachmentMimeType ?? 'application/octet-stream',
            fileName: dto.attachmentFileName ?? 'file',
            size: dto.attachmentSize ?? 0,
          },
        });
      }

      await tx.conversation.update({
        where: { id: conversationId },
        data: {
          lastMessageAt: new Date(),
          // Only touched on INBOUND — an OUTBOUND reply (agent or operator)
          // must never overwrite whatever the last real customer message
          // established. A real inbound (dto.viaWebWindow unset) always
          // resets this to false, restoring normal external delivery.
          ...(dto.direction === 'INBOUND' && { lastInboundViaWebWindow: !!dto.viaWebWindow }),
          // A customer who actually followed the "Continuar por web" link
          // and started typing here is deliberately engaging — the WhatsApp
          // returning-contact brake (aiPaused, see MetaWebhookService) was
          // only ever meant to stop unsolicited AI chatter on WhatsApp
          // itself, never to also mute the dedicated hand-off window once
          // they chose to use it.
          ...(dto.direction === 'INBOUND' && dto.viaWebWindow && { aiPaused: false }),
        },
      });

      return tx.message.findUnique({
        where: { id: created.id },
        include: { attachments: true },
      });
    });

    // Notifies (a) the dashboard's chat panel for THIS open conversation,
    // (b) every staff member's conversations LIST for this tenant (a new or
    // updated conversation needs to show up there even if nobody has it
    // open yet), and (c) for a WEBCHAT conversation, the anonymous widget —
    // see RealtimeGateway's @OnEvent('message.created') handler. Fired for
    // either direction: staff needs to see an inbound customer message land
    // live, and a webchat visitor needs to see the AI's/agent's outbound
    // reply live.
    this.eventEmitter.emit('message.created', { conversationId, tenantId: (conversation as any).tenantId });

    if (dto.direction === 'OUTBOUND') {
      // conversation is the pre-transaction fetch, so it still reflects
      // whichever inbound message most recently set this flag — while the
      // customer is active in the web window, replies stay there (still
      // pushed live via message.created below) instead of also hitting
      // their real WhatsApp/Instagram/etc.
      if (!(conversation as any).lastInboundViaWebWindow) {
        await this.enqueueOutboundIfConnected(conversation, message.id);
      }
    } else {
      await this.eventsService.emit(
        'message.received',
        { conversationId, messageId: message.id, content: dto.content },
        (conversation as any).contactId,
      );
      if (type === 'AUDIO') {
        // Phase 26: Voice/audio transcription — the AI reply pipeline only
        // runs once AiTranscriptionService fills in the real transcript;
        // enqueueing an AI reply now would hand the agent an empty message.
        await this.queueService.enqueueTranscription((conversation as any).tenantId, message.id);
      } else if (!dto.skipAiReply) {
        // Phase 13: AI foundation — off the hot path, mirrors enqueueWorkflowEvent
        // right above. AiReplyService (via apps/worker) decides whether any
        // agent should actually respond.
        await this.queueService.enqueueAiReply((conversation as any).tenantId, conversationId, message.id);
      }
    }

    return message;
  }

  // Human-operator path for the two new interactive message kinds (the AI
  // agent sends the same shapes directly via AiReplyService's
  // send_quick_replies/send_form tools, bypassing this but hitting the same
  // create() underneath) — see MessagesController for the HTTP endpoints.
  async sendQuickReplies(conversationId: string, actorUserId: string, dto: SendQuickRepliesDto) {
    const options = dto.options.map((label, i) => ({ id: `opt_${i}`, label }));
    return this.create(conversationId, actorUserId, {
      direction: 'OUTBOUND',
      type: 'INTERACTIVE',
      content: dto.message,
      interactivePayload: { kind: 'quick_replies', message: dto.message, options },
    } as any);
  }

  async sendForm(conversationId: string, actorUserId: string, dto: SendFormDto) {
    const conversation = await this.conversationsService.findOne(conversationId);
    if (conversation.channel !== 'WEBCHAT') {
      throw new ValidationError('Forms can only be sent on web chat conversations — WhatsApp/Instagram/etc. have no native multi-field form message type.');
    }
    const fields = dto.fields.map((f, i) => ({ id: `field_${i}`, label: f.label, fieldType: f.fieldType }));
    return this.create(conversationId, actorUserId, {
      direction: 'OUTBOUND',
      type: 'INTERACTIVE',
      content: dto.message,
      interactivePayload: { kind: 'form', message: dto.message, fields, submitLabel: dto.submitLabel?.trim() || 'Enviar' },
    } as any);
  }

  // Facebook (Channel.FACEBOOK) is intentionally excluded — that enum value
  // is reserved/unused (Messenger DMs use Channel.MESSENGER instead, see
  // meta-connection.controller.ts), so it falls through as a documented no-op.
  private async enqueueOutboundIfConnected(conversation: { channel: string; tenantId: string }, messageId: string) {
    if (conversation.channel === 'WHATSAPP' || conversation.channel === 'INSTAGRAM' || conversation.channel === 'MESSENGER') {
      const connection = await this.prisma.client.metaConnection.findUnique({
        where: { tenantId_channel: { tenantId: conversation.tenantId, channel: conversation.channel as any } },
      });
      if (connection && connection.status === 'CONNECTED') {
        await this.queueService.enqueueChannelOutboundMessage(conversation.channel as any, messageId);
      }
      return;
    }

    if (conversation.channel === 'TIKTOK') {
      const connection = await this.prisma.client.tikTokConnection.findUnique({
        where: { tenantId: conversation.tenantId },
      });
      if (connection && connection.status === 'CONNECTED') {
        await this.queueService.enqueueChannelOutboundMessage('TIKTOK' as any, messageId);
      }
    }
  }
}
