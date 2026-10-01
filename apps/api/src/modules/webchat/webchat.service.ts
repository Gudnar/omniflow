import { Injectable } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { NotFoundError, ValidationError } from '@omniflow/utils';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContextService } from '../tenant-context/tenant-context.service';
import { ContactsService } from '../contacts/contacts.service';
import { ConversationsService } from '../conversations/conversations.service';
import { MessagesService } from '../conversations/messages.service';

/**
 * Public, unauthenticated chat widget — mounted on either the Página de
 * Enlaces or the public storefront, both gated by their own independent
 * `chatEnabled` toggle. Same "resolve tenant from an opaque public
 * identifier via the raw client, then seed TenantContextService and
 * delegate into the normal, already-tested tenant-scoped domain services"
 * pattern as StorefrontService and LinkPageService. No raw conversationId is
 * ever trusted alone — every call after `start()`/`startFromStore()` also
 * requires the matching webchatToken (mirrors the storefront's own
 * slug+publicToken pair).
 */
@Injectable()
export class WebchatService {
  constructor(
    private prisma: PrismaService,
    private tenantContext: TenantContextService,
    private contactsService: ContactsService,
    private conversationsService: ConversationsService,
    private messagesService: MessagesService,
  ) {}

  async start(linkPageSlug: string) {
    const page = await this.prisma.raw.linkPage.findUnique({ where: { slug: linkPageSlug } });
    if (!page || page.status !== 'PUBLISHED' || !page.chatEnabled) {
      throw new NotFoundError('Chat');
    }
    return this.createAnonymousConversation(page.tenantId);
  }

  async startFromStore(storeSlug: string) {
    const store = await this.prisma.raw.ecommerceStore.findUnique({ where: { slug: storeSlug } });
    if (!store || store.status !== 'PUBLISHED' || !store.chatEnabled) {
      throw new NotFoundError('Chat');
    }
    return this.createAnonymousConversation(store.tenantId);
  }

  private async createAnonymousConversation(tenantId: string) {
    this.tenantContext.setContext({ tenantId });

    const contact = await this.contactsService.create({
      name: 'Visitante web',
      source: 'WEBSITE',
    } as any);

    const conversation = await this.conversationsService.create({
      contactId: contact.id,
      channel: 'WEBCHAT',
      externalId: randomBytes(16).toString('hex'),
    } as any);

    const webchatToken = randomBytes(32).toString('hex');
    await this.prisma.client.conversation.update({
      where: { id: conversation.id },
      data: { webchatToken },
    });

    return { conversationId: conversation.id, webchatToken };
  }

  // Resolves the conversation AND seeds tenant context from it — never from
  // client-supplied input — before the caller delegates into any
  // tenant-scoped service.
  private async requireConversation(conversationId: string, webchatToken: string | undefined) {
    if (!webchatToken) throw new ValidationError('webchatToken is required');

    const conversation = await this.prisma.raw.conversation.findUnique({ where: { id: conversationId } });
    if (!conversation || conversation.webchatToken !== webchatToken) {
      throw new NotFoundError('Conversation');
    }

    this.tenantContext.setContext({ tenantId: conversation.tenantId });
    return conversation;
  }

  async sendMessage(conversationId: string, webchatToken: string, content: string) {
    await this.requireConversation(conversationId, webchatToken);
    return this.messagesService.create(conversationId, '', { direction: 'INBOUND', content } as any);
  }

  async listMessages(conversationId: string, webchatToken: string | undefined) {
    await this.requireConversation(conversationId, webchatToken);
    return this.messagesService.list(conversationId);
  }
}
