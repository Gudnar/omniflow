import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContextService } from '../tenant-context/tenant-context.service';
import { ContactsService } from '../contacts/contacts.service';
import { ConversationsService } from '../conversations/conversations.service';
import { MessagesService } from '../conversations/messages.service';
import { logger } from '@omniflow/utils';

/**
 * NOTE: this payload shape ({ event, data: { business_id, sender: { open_id },
 * message: { text, message_id } } }) is a best-effort, explicitly unverified
 * guess at TikTok's Business Messaging v1.3 webhook format — their portal
 * docs weren't fully accessible at implementation time. Must be checked
 * against a real payload before going live.
 */
@Injectable()
export class TikTokWebhookService {
  constructor(
    private prisma: PrismaService,
    private tenantContext: TenantContextService,
    private contactsService: ContactsService,
    private conversationsService: ConversationsService,
    private messagesService: MessagesService,
  ) {}

  async handlePayload(body: any): Promise<void> {
    if (body?.event !== 'message.received') {
      logger.warn('TikTok webhook: unrecognized event type', { event: body?.event });
      return;
    }

    const data = body?.data;
    const businessId = data?.business_id;
    const openId = data?.sender?.open_id;
    const text = data?.message?.text;
    const messageId = data?.message?.message_id;

    if (!businessId || !openId || !messageId) return;

    const connection = await this.prisma.raw.tikTokConnection.findUnique({ where: { businessId } });
    if (!connection) {
      logger.warn('TikTok webhook: no connection for business id', { businessId });
      return;
    }
    this.tenantContext.setContext({ tenantId: connection.tenantId });

    const existing = await this.prisma.raw.message.findUnique({ where: { externalId: messageId } });
    if (existing) {
      logger.info('TikTok webhook: duplicate message, skipping', { externalId: messageId });
      return;
    }

    const contactChannel = await this.prisma.client.contactChannel.findFirst({
      where: { channel: 'TIKTOK', externalId: openId },
    });

    if (!contactChannel) {
      // open_id is not a phone number, unlike WhatsApp's externalContactId.
      const contact = await this.contactsService.create({
        name: openId,
        source: 'TIKTOK',
      } as any);

      await this.conversationsService.create({
        contactId: contact.id,
        channel: 'TIKTOK',
        externalId: openId,
        firstMessageContent: text ?? '',
        firstMessageExternalId: messageId,
      } as any);
      return;
    }

    const openConversation = await this.prisma.client.conversation.findFirst({
      where: { contactChannelId: contactChannel.id, status: { not: 'CLOSED' } },
      orderBy: { lastMessageAt: 'desc' },
    });

    if (!openConversation) {
      await this.conversationsService.create({
        contactId: contactChannel.contactId,
        channel: 'TIKTOK',
        externalId: openId,
        firstMessageContent: text ?? '',
        firstMessageExternalId: messageId,
      } as any);
      return;
    }

    await this.messagesService.create(openConversation.id, undefined as any, {
      direction: 'INBOUND',
      type: 'TEXT',
      content: text ?? '',
      externalId: messageId,
    } as any);
  }
}
