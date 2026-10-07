import { Injectable } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service';
import { ContactsService } from '../contacts/contacts.service';
import { QueueService } from '../queue/queue.service';
import { NotFoundError } from '@omniflow/utils';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { UpdateConversationStatusDto } from './dto/update-conversation-status.dto';
import { AssignConversationDto } from './dto/assign-conversation.dto';
import { ListConversationsQueryDto } from './dto/list-conversations-query.dto';

const CONVERSATION_LIST_INCLUDE = {
  contact: { select: { id: true, name: true } },
  branch: { select: { id: true, name: true } },
};

const CONVERSATION_DETAIL_INCLUDE = {
  ...CONVERSATION_LIST_INCLUDE,
  contactChannel: true,
};

@Injectable()
export class ConversationsService {
  constructor(
    private prisma: PrismaService,
    private contactsService: ContactsService,
    private queueService: QueueService,
    private eventEmitter: EventEmitter2,
  ) {}

  async list(tenantId: string, filters: ListConversationsQueryDto) {
    return this.prisma.client.conversation.findMany({
      where: {
        tenantId,
        ...(filters.status && { status: filters.status }),
        ...(filters.channel && { channel: filters.channel }),
        ...(filters.contactId && { contactId: filters.contactId }),
        ...(filters.branchId && { branchId: filters.branchId }),
        ...(filters.assignedToId && { assignedToId: filters.assignedToId }),
      },
      include: CONVERSATION_LIST_INCLUDE,
      orderBy: [{ lastMessageAt: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async findOne(id: string) {
    const conversation = await this.prisma.client.conversation.findUnique({
      where: { id },
      include: CONVERSATION_DETAIL_INCLUDE,
    });
    if (!conversation) throw new NotFoundError('Conversation');
    return conversation;
  }

  async create(dto: CreateConversationDto) {
    await this.contactsService.findOne(dto.contactId);

    let firstMessageId: string | undefined;

    const result = await this.prisma.client.$transaction(async (tx: any) => {
      let contactChannelId: string | undefined;

      if (dto.externalId) {
        const contactChannel = await tx.contactChannel.upsert({
          where: { contactId_channel: { contactId: dto.contactId, channel: dto.channel } },
          update: { externalId: dto.externalId },
          create: {
            contactId: dto.contactId,
            channel: dto.channel,
            externalId: dto.externalId,
          },
        });
        contactChannelId = contactChannel.id;
      }

      const conversation = await tx.conversation.create({
        data: {
          contactId: dto.contactId,
          channel: dto.channel,
          contactChannelId,
          branchId: dto.branchId,
          assignedToId: dto.assignedToId,
          lastMessageAt: dto.firstMessageContent ? new Date() : undefined,
          isNewContact: dto.isNewContact ?? false,
          adReferral: dto.adReferral ?? undefined,
        },
      });

      if (dto.firstMessageContent) {
        const message = await tx.message.create({
          data: {
            conversationId: conversation.id,
            direction: 'INBOUND',
            type: 'TEXT',
            content: dto.firstMessageContent,
            externalId: dto.firstMessageExternalId,
          },
        });
        firstMessageId = message.id;
      }

      return tx.conversation.findUnique({
        where: { id: conversation.id },
        include: CONVERSATION_DETAIL_INCLUDE,
      });
    });

    // The very first message of a brand-new conversation (a channel webhook's
    // first-ever contact) is written directly above, bypassing
    // MessagesService.create() entirely — which is the ONLY place that
    // normally emits 'message.created' (live conversation list/chat-panel
    // updates via RealtimeGateway) and enqueues the AI reply job. Without
    // this, a contact's very first message silently never showed up live
    // (staff had to reload) and never got an autoreply. Mirrors exactly what
    // MessagesService.create() does for every other INBOUND message.
    if (firstMessageId) {
      this.eventEmitter.emit('message.created', { conversationId: result.id, tenantId: (result as any).tenantId });
      if (!dto.skipAiReply) {
        await this.queueService.enqueueAiReply((result as any).tenantId, result.id, firstMessageId);
      }
    }

    return result;
  }

  async updateStatus(id: string, dto: UpdateConversationStatusDto) {
    await this.findOne(id);
    return this.prisma.client.conversation.update({
      where: { id },
      data: { status: dto.status },
    });
  }

  // Lets an operator hand control back to the AI agent after the
  // WhatsApp "returning contact" one-shot CTA flow paused it (see
  // MetaWebhookService.processInboundMessage) — the only way out of that
  // state short of replying manually forever.
  async setAiPaused(id: string, aiPaused: boolean) {
    await this.findOne(id);
    return this.prisma.client.conversation.update({ where: { id }, data: { aiPaused } });
  }

  async assign(id: string, dto: AssignConversationDto, actorUserId: string) {
    await this.findOne(id);

    return this.prisma.client.$transaction(async (tx: any) => {
      const conversation = await tx.conversation.update({
        where: { id },
        data: { assignedToId: dto.assignedToId ?? null },
      });

      await tx.message.create({
        data: {
          conversationId: id,
          direction: 'OUTBOUND',
          type: 'SYSTEM',
          senderId: actorUserId,
          content: dto.assignedToId
            ? `Conversación asignada a ${dto.assignedToId}`
            : 'Conversación sin asignar',
        },
      });

      return conversation;
    });
  }

  // Mints (or renews — overwriting always invalidates whatever link was
  // handed out before) an opaque public-access token for THIS conversation,
  // reusing the exact field/validation ConversationWindowService and
  // RealtimeGateway already trust for the Página de Enlaces' webchat widget
  // — that logic never assumed the token could only belong to a WEBCHAT
  // conversation, so no schema change or gateway change was needed to reuse
  // it here for an existing WhatsApp/Instagram/etc. conversation.
  async generateWebLink(id: string) {
    await this.findOne(id);
    const webchatToken = randomBytes(32).toString('hex');
    // A fresh token means a fresh session — webWindowGreetedAt resets so the
    // proactive greeting (ConversationWindowService.getWindow) fires again
    // the next time this new link is opened.
    await this.prisma.client.conversation.update({ where: { id }, data: { webchatToken, webWindowGreetedAt: null } });

    const baseUrl = process.env.STOREFRONT_BASE_URL || 'http://localhost:3000';
    return { url: `${baseUrl}/chat/${webchatToken}`, token: webchatToken };
  }

  // Same link as generateWebLink, but never invalidates one already handed
  // out — for callers that might offer this link more than once in the same
  // conversation (the AI agent's send_webchat_link tool) and must not
  // silently break a session the customer already opened in their browser.
  // Only the explicit "Enviar enlace web" admin action should ever force a
  // fresh, previous-link-invalidating token — see generateWebLink above.
  async getOrCreateWebLink(id: string) {
    const conversation = await this.findOne(id);
    if ((conversation as any).webchatToken) {
      const baseUrl = process.env.STOREFRONT_BASE_URL || 'http://localhost:3000';
      return { url: `${baseUrl}/chat/${(conversation as any).webchatToken}`, token: (conversation as any).webchatToken };
    }
    return this.generateWebLink(id);
  }
}
