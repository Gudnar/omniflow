import { Injectable } from '@nestjs/common';
import { NotFoundError } from '@omniflow/utils';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContextService } from '../tenant-context/tenant-context.service';
import { MessagesService } from '../conversations/messages.service';
import { QueueService } from '../queue/queue.service';

// Never expose these to a customer-facing view — NOTE is staff-only
// shorthand ("Nota interna" in chat-panel.tsx) and SYSTEM is our own
// internal audit trail (assignment changes, etc.), neither meant to be read
// by the person the conversation is about. CTA is customer-facing by design
// — it's how the AI agent's send_storefront_link tool reaches this window.
const CUSTOMER_VISIBLE_TYPES = ['TEXT', 'AUDIO', 'TEMPLATE', 'CTA'] as const;

/**
 * Public, unauthenticated "continue this conversation from the web" window —
 * reuses Conversation.webchatToken (the exact field/validation shape
 * RealtimeGateway and WebchatService already trust for the Página de
 * Enlaces widget) to grant access to an EXISTING conversation instead of
 * minting a new one. Same "resolve tenant from an opaque token via the raw
 * client, then seed TenantContextService" pattern as every other public
 * surface in this codebase.
 */
@Injectable()
export class ConversationWindowService {
  constructor(
    private prisma: PrismaService,
    private tenantContext: TenantContextService,
    private messagesService: MessagesService,
    private queueService: QueueService,
  ) {}

  private async requireConversation(token: string) {
    const conversation = await this.prisma.raw.conversation.findUnique({ where: { webchatToken: token } });
    if (!conversation) throw new NotFoundError('Conversation');
    this.tenantContext.setContext({ tenantId: conversation.tenantId });
    return conversation;
  }

  async getWindow(token: string) {
    const conversation = await this.requireConversation(token);

    // Proactive "welcome to web chat" greeting — fires once per active link.
    // The updateMany's own where clause is what makes this race-safe: the
    // socket re-calls getWindow() on every message.created, including the
    // greeting's own reply, so only the very first caller to see
    // webWindowGreetedAt: null actually wins the race and enqueues it.
    const { count } = await this.prisma.client.conversation.updateMany({
      where: { id: conversation.id, webWindowGreetedAt: null },
      data: { webWindowGreetedAt: new Date(), aiPaused: false },
    });
    if (count > 0) {
      await this.queueService.enqueueAiReply(conversation.tenantId, conversation.id, null);
    }

    // Prefer the channel's own connection display name (e.g. the WhatsApp
    // number's verified business name) for the header; MetaConnection has
    // no row at all for WEBCHAT/TIKTOK conversations, in which case this
    // simply resolves to null and the tenant's own name is used instead.
    const connection = await this.prisma.raw.metaConnection.findUnique({
      where: { tenantId_channel: { tenantId: conversation.tenantId, channel: conversation.channel } },
    });
    const tenant = await this.prisma.raw.tenant.findUnique({ where: { id: conversation.tenantId } });

    const messages = await this.prisma.raw.message.findMany({
      where: { conversationId: conversation.id, type: { in: [...CUSTOMER_VISIBLE_TYPES] } },
      include: { attachments: true },
      orderBy: { createdAt: 'asc' },
    });

    return {
      businessName: connection?.displayName || tenant?.name || 'Negocio',
      businessLogo: tenant?.logo ?? null,
      // Never the raw rows — tenantId/senderId/campaignId are internal ids
      // with no business being handed to an anonymous customer-facing view
      // (same discipline StorefrontService already applies to its own
      // public responses).
      messages: messages.map((m: any) => ({
        id: m.id,
        direction: m.direction,
        type: m.type,
        content: m.content,
        createdAt: m.createdAt,
        ctaPayload: m.ctaPayload ?? null,
        attachments: m.attachments.map((a: any) => ({ id: a.id, url: a.url, mimeType: a.mimeType, fileName: a.fileName })),
      })),
    };
  }

  async sendMessage(token: string, content: string) {
    const conversation = await this.requireConversation(token);
    // Marks the conversation as "active in the web window" — MessagesService
    // .create() reads this to skip re-dispatching the next reply to the
    // real external channel while the customer is chatting here instead.
    return this.messagesService.create(conversation.id, '', { direction: 'INBOUND', content, viaWebWindow: true } as any);
  }
}
