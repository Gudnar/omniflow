import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContextService } from '../tenant-context/tenant-context.service';
import { ContactsService } from '../contacts/contacts.service';
import { ConversationsService } from '../conversations/conversations.service';
import { MessagesService } from '../conversations/messages.service';
import { TemplatesService } from '../templates/templates.service';
import { StorageService } from '../storage/storage.service';
import { FacebookCommentsService } from '../facebook-comments/facebook-comments.service';
import { ContactCommerceService } from '../commerce/contact-commerce.service';
import { Channel, MessageType } from '@omniflow/database';
import { logger } from '@omniflow/utils';

const WHATSAPP_GRAPH_API_VERSION = 'v19.0';

interface NormalizedInboundMessage {
  externalContactId: string;
  content: string;
  externalMessageId: string;
  profileName?: string;
  // Phase 26: Voice/audio transcription — set only for a WhatsApp voice
  // note, already downloaded from Meta's Media API by the time this reaches
  // processInboundMessage.
  type?: MessageType;
  audio?: { buffer: Buffer; mimeType: string };
  // Set only when WhatsApp attaches a `referral` to the message — a tap on
  // a Click-to-WhatsApp ad. Only present on WhatsApp payloads today
  // (Instagram/Messenger's messaging events carry no such field).
  referral?: {
    sourceUrl?: string;
    sourceType?: string;
    sourceId?: string;
    headline?: string;
    body?: string;
    mediaType?: string;
    ctwaClid?: string;
  };
}

@Injectable()
export class MetaWebhookService {
  constructor(
    private prisma: PrismaService,
    private tenantContext: TenantContextService,
    private contactsService: ContactsService,
    private conversationsService: ConversationsService,
    private messagesService: MessagesService,
    private templatesService: TemplatesService,
    private storageService: StorageService,
    private facebookCommentsService: FacebookCommentsService,
    private contactCommerceService: ContactCommerceService,
  ) {}

  async handlePayload(body: any): Promise<void> {
    if (body?.object === 'whatsapp_business_account') {
      for (const entry of body?.entry ?? []) {
        for (const change of entry?.changes ?? []) {
          // Real WABA webhooks distinguish message events (field: "messages")
          // from template review events (field: "message_template_status_update")
          // — Phase 17: Campaigns/Templates.
          if (change?.field === 'message_template_status_update') {
            await this.handleTemplateStatusUpdate(entry?.id, change?.value ?? {});
          } else {
            await this.handleWhatsAppChange(change?.value ?? {});
          }
        }
      }
      return;
    }

    if (body?.object === 'instagram' || body?.object === 'page') {
      // Facebook Page DMs (Messenger) are stored internally as
      // Channel.MESSENGER — see meta-connection.controller.ts for the same
      // route-name-vs-stored-channel mapping.
      const channel: Channel = body.object === 'instagram' ? 'INSTAGRAM' : 'MESSENGER';
      for (const entry of body?.entry ?? []) {
        for (const messagingEvent of entry?.messaging ?? []) {
          await this.handleMessagingEvent(channel, messagingEvent);
        }

        // Phase 27: Facebook Page comments — a Page's `feed` field arrives
        // as entry.changes (not entry.messaging), on the very same
        // object: 'page' payload DMs use. Instagram comments are a distinct,
        // not-yet-implemented surface (the user only asked for Facebook).
        if (body.object === 'page') {
          for (const change of entry?.changes ?? []) {
            if (change?.field !== 'feed') continue;
            try {
              await this.facebookCommentsService.handleFeedChange(entry?.id, change?.value ?? {});
            } catch (error) {
              logger.error('Meta webhook: failed processing Facebook feed change', error as Error, {
                entryId: entry?.id,
              });
            }
          }
        }
      }
      return;
    }

    logger.warn('Meta webhook: unrecognized object type', { object: body?.object });
  }

  private async handleWhatsAppChange(value: any): Promise<void> {
    const phoneNumberId = value?.metadata?.phone_number_id;
    if (!phoneNumberId) return;

    const connection = await this.resolveConnection('WHATSAPP', phoneNumberId);
    if (!connection) return;

    for (const msg of value.messages ?? []) {
      try {
        // Phase 26: Voice/audio transcription — a voice note has no
        // msg.text at all, only msg.audio.id (a Meta media id, not a URL).
        // Download it now, inside the same try/catch as any other inbound
        // message, so one bad download doesn't sink the whole webhook batch.
        if (msg.type === 'audio' && msg.audio?.id) {
          const media = await this.downloadWhatsAppMedia(msg.audio.id, connection.accessToken);
          if (!media) {
            logger.error('Meta webhook: could not download WhatsApp audio, skipping message', undefined, {
              externalId: msg.id,
            });
            continue;
          }
          await this.processInboundMessage('WHATSAPP', {
            externalContactId: msg.from,
            content: '',
            externalMessageId: msg.id,
            profileName: value.contacts?.[0]?.profile?.name,
            type: 'AUDIO',
            audio: media,
          });
          continue;
        }

        // A tap on a native interactive button/list we sent (see
        // whatsapp-outbound-processor.ts) arrives with msg.type === 'interactive'
        // and no msg.text at all — the chosen option's title is the closest
        // thing to "what the customer typed", same as a quick-reply tap on
        // web chat becomes a plain INBOUND text message there.
        const interactiveReplyTitle = msg.interactive?.button_reply?.title ?? msg.interactive?.list_reply?.title;

        await this.processInboundMessage('WHATSAPP', {
          externalContactId: msg.from,
          content: interactiveReplyTitle ?? msg.text?.body ?? '',
          externalMessageId: msg.id,
          profileName: value.contacts?.[0]?.profile?.name,
          referral: msg.referral
            ? {
                sourceUrl: msg.referral.source_url,
                sourceType: msg.referral.source_type,
                sourceId: msg.referral.source_id,
                headline: msg.referral.headline,
                body: msg.referral.body,
                mediaType: msg.referral.media_type,
                ctwaClid: msg.referral.ctwa_clid,
              }
            : undefined,
        });
      } catch (error) {
        logger.error('Meta webhook: failed processing WhatsApp inbound message', error as Error, {
          externalId: msg?.id,
        });
      }
    }

    for (const status of value.statuses ?? []) {
      // Message model has no delivery-status field (explicitly deferred) —
      // log only for now.
      logger.info('WhatsApp status update received', { externalId: status.id, status: status.status });
    }
  }

  // Phase 17: Campaigns/Templates — auto-sync a template's review status the
  // moment Meta reports it, rather than relying only on the manual
  // POST /templates/:id/sync-status fallback. Resolved by WABA id (the
  // entry's own `id`), not phone_number_id, since a template-review event
  // isn't tied to any one phone number.
  private async handleTemplateStatusUpdate(wabaId: string | undefined, value: any): Promise<void> {
    if (!wabaId) return;

    // Cross-tenant lookup by Meta's own WABA id — same rationale as
    // resolveConnection() below.
    const connection = await this.prisma.raw.metaConnection.findFirst({
      where: { channel: 'WHATSAPP', wabaId },
    });
    if (!connection) {
      logger.warn('Meta webhook: no connection for WABA id (template status update)', { wabaId });
      return;
    }

    const template = await this.templatesService.findByExternalId(
      connection.tenantId,
      String(value.message_template_id ?? ''),
    );
    if (!template) {
      logger.warn('Meta webhook: template status update for unknown template', {
        wabaId,
        messageTemplateId: value.message_template_id,
      });
      return;
    }

    this.tenantContext.setContext({ tenantId: connection.tenantId });
    await this.templatesService.applyStatusUpdate(template.id, value.event, value.reason);
  }

  private async handleMessagingEvent(channel: Channel, event: any): Promise<void> {
    const recipientId = event?.recipient?.id; // IG business account id or Page id
    if (!recipientId) return;

    const connection = await this.resolveConnection(channel, recipientId);
    if (!connection) return;

    if (!event?.message?.text) {
      // Ignore non-text events (reactions, read receipts, delivery
      // confirmations, etc.) for now, same "log only" precedent as
      // WhatsApp's .statuses handling above.
      return;
    }

    try {
      await this.processInboundMessage(channel, {
        externalContactId: event.sender.id,
        content: event.message.text,
        externalMessageId: event.message.mid,
        // Instagram/Messenger messaging payloads don't carry a profile name
        // inline (unlike WhatsApp's contacts[].profile.name) — a real lookup
        // would need a separate Graph API call, deferred as a follow-up.
        // processInboundMessage already falls back to externalContactId when
        // profileName is absent, same as WhatsApp does.
        profileName: undefined,
      });
    } catch (error) {
      logger.error('Meta webhook: failed processing inbound message', error as Error, {
        channel,
        externalId: event?.message?.mid,
      });
    }
  }

  private async resolveConnection(channel: Channel, externalAccountId: string) {
    // Cross-tenant lookup by Meta's own external identifier — this is the
    // one legitimate use of the unscoped raw client outside pre-auth flows.
    const connection = await this.prisma.raw.metaConnection.findUnique({
      where: { channel_externalAccountId: { channel, externalAccountId } },
    });

    if (!connection) {
      logger.warn('Meta webhook: no connection for external account id', { channel, externalAccountId });
      return null;
    }

    this.tenantContext.setContext({ tenantId: connection.tenantId });
    return connection;
  }

  private async processInboundMessage(channel: Channel, msg: NormalizedInboundMessage): Promise<void> {
    const existing = await this.prisma.raw.message.findUnique({
      where: { externalId: msg.externalMessageId },
    });
    if (existing) {
      logger.info('Meta webhook: duplicate message, skipping', { channel, externalId: msg.externalMessageId });
      return;
    }

    const contactChannel = await this.prisma.client.contactChannel.findFirst({
      where: { channel, externalId: msg.externalContactId },
    });

    // NOTE: a voice note as a brand-new contact's very first message falls
    // through these two branches, which create the conversation with a bare
    // firstMessageContent string (pre-dates Phase 26, no Attachment support
    // here) — same pre-existing limitation any non-text first message
    // already had. The common case (audio in an already-open conversation)
    // is fully supported below.
    if (!contactChannel) {
      const contact = await this.contactsService.create({
        name: msg.profileName || msg.externalContactId,
        // An IGSID/PSID is not a phone number — only WhatsApp's externalId is.
        ...(channel === 'WHATSAPP' ? { phone: msg.externalContactId } : {}),
        source: channel,
      } as any);

      await this.conversationsService.create({
        contactId: contact.id,
        channel,
        externalId: msg.externalContactId,
        firstMessageContent: msg.content,
        firstMessageExternalId: msg.externalMessageId,
        isNewContact: true,
        adReferral: msg.referral,
      } as any);
      return;
    }

    const openConversation = await this.prisma.client.conversation.findFirst({
      where: { contactChannelId: contactChannel.id, status: { not: 'CLOSED' } },
      orderBy: { lastMessageAt: 'desc' },
    });

    if (!openConversation) {
      // Only WhatsApp gets the one-shot "here are your options" brake — a
      // returning contact reopening on Instagram/Messenger/TikTok/webchat
      // still gets the normal, full AI conversation, same as a new contact.
      const isReturningWhatsAppContact = channel === 'WHATSAPP';

      const conversation = await this.conversationsService.create({
        contactId: contactChannel.contactId,
        channel,
        externalId: msg.externalContactId,
        firstMessageContent: msg.content,
        firstMessageExternalId: msg.externalMessageId,
        isNewContact: false,
        adReferral: msg.referral,
        skipAiReply: isReturningWhatsAppContact,
      } as any);

      if (isReturningWhatsAppContact) {
        const tenantId = this.tenantContext.getTenantId();
        if (tenantId) {
          await this.sendReturningContactOptions(tenantId, conversation.id, contactChannel.contactId);
        }
      }
      return;
    }

    let attachment: { url: string; mimeType: string; fileName: string; size: number } | undefined;
    if (msg.type === 'AUDIO' && msg.audio) {
      const tenantId = this.tenantContext.getTenantId();
      if (tenantId) {
        const saved = await this.storageService.saveAudioBuffer(tenantId, msg.audio.buffer, msg.audio.mimeType);
        const extension = saved.url.split('.').pop();
        attachment = {
          url: saved.url,
          mimeType: saved.mimeType,
          fileName: `audio.${extension}`,
          size: msg.audio.buffer.length,
        };
      }
    }

    await this.messagesService.create(openConversation.id, undefined as any, {
      direction: 'INBOUND',
      type: msg.type ?? 'TEXT',
      content: msg.content,
      externalId: msg.externalMessageId,
      attachmentUrl: attachment?.url,
      attachmentMimeType: attachment?.mimeType,
      attachmentFileName: attachment?.fileName,
      attachmentSize: attachment?.size,
    } as any);
  }

  // The WhatsApp "returning contact" brake: instead of letting the AI agent
  // have a back-and-forth, send up to 3 deterministic CTA messages (store /
  // booking / continue-on-web — only whichever actually apply) and pause the
  // agent on this conversation. Reuses the exact same link builders the
  // agent's own send_storefront_link tool and the admin's "Enviar enlace
  // web" button already rely on (ContactCommerceService.generateStorefrontLink,
  // ConversationsService.generateWebLink) — never invents a URL here.
  // WhatsApp's cta_url interactive type carries only one link per message
  // (see whatsapp-outbound-processor.ts), so "one message" becomes "one
  // message per available option" rather than a single combined message.
  private async sendReturningContactOptions(tenantId: string, conversationId: string, contactId: string): Promise<void> {
    const store = await this.prisma.client.ecommerceStore.findUnique({ where: { tenantId } });
    const storeAvailable = store?.status === 'PUBLISHED';
    const canBuy = storeAvailable && (store!.operationMode === 'DIRECT_SALE' || store!.operationMode === 'BOTH');
    const canBook = storeAvailable && (store!.operationMode === 'BOOKING' || store!.operationMode === 'BOTH');

    if (canBuy || canBook) {
      try {
        const { url: storeUrl } = await this.contactCommerceService.generateStorefrontLink(contactId);
        const [path, query] = storeUrl.split('?');

        if (canBuy) {
          await this.messagesService.create(conversationId, undefined as any, {
            direction: 'OUTBOUND',
            type: 'CTA',
            content: `Puedes ver nuestra tienda aquí:\n\n${storeUrl}`,
            ctaPayload: { action: 'STORE', url: storeUrl, label: 'Ir a la tienda' },
          } as any);
        }
        if (canBook) {
          const bookingUrl = `${path}/reservas?${query}`;
          await this.messagesService.create(conversationId, undefined as any, {
            direction: 'OUTBOUND',
            type: 'CTA',
            content: `Puedes reservar tu cita aquí:\n\n${bookingUrl}`,
            ctaPayload: { action: 'BOOKING', url: bookingUrl, label: 'Reservar cita' },
          } as any);
        }
      } catch (error) {
        logger.error('Meta webhook: failed generating storefront link for returning contact', error as Error, { conversationId });
      }
    }

    try {
      const { url: webUrl } = await this.conversationsService.generateWebLink(conversationId);
      await this.messagesService.create(conversationId, undefined as any, {
        direction: 'OUTBOUND',
        type: 'CTA',
        content: `O seguimos la conversación desde la web:\n\n${webUrl}`,
        ctaPayload: { action: 'STORE', url: webUrl, label: 'Continuar por web' },
      } as any);
    } catch (error) {
      logger.error('Meta webhook: failed generating web link for returning contact', error as Error, { conversationId });
    }

    await this.prisma.client.conversation.update({ where: { id: conversationId }, data: { aiPaused: true } });
  }

  // Meta's Media API is two hops: resolve the media id to a short-lived,
  // authenticated CDN URL, then fetch that URL — both calls need the same
  // Bearer token (SECURITY.md: nothing about this is a public URL).
  private async downloadWhatsAppMedia(
    mediaId: string,
    accessToken: string,
  ): Promise<{ buffer: Buffer; mimeType: string } | null> {
    try {
      const metaResponse = await fetch(`https://graph.facebook.com/${WHATSAPP_GRAPH_API_VERSION}/${mediaId}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!metaResponse.ok) return null;
      const meta: any = await metaResponse.json();

      const fileResponse = await fetch(meta.url, { headers: { Authorization: `Bearer ${accessToken}` } });
      if (!fileResponse.ok) return null;

      const buffer = Buffer.from(await fileResponse.arrayBuffer());
      return { buffer, mimeType: meta.mime_type };
    } catch (error) {
      logger.error('Meta webhook: failed downloading WhatsApp audio media', error as Error, { mediaId });
      return null;
    }
  }
}
