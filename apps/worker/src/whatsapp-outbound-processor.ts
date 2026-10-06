import { prisma } from '@omniflow/database';
import { logger } from '@omniflow/utils';

const GRAPH_API_VERSION = 'v19.0';

export interface ChannelOutboundJobData {
  messageId: string;
}

// WhatsApp's native reply-button titles are capped at 20 characters by the
// Graph API itself — truncated here rather than left to fail the whole send.
const WHATSAPP_BUTTON_TITLE_MAX = 20;

// Builds the Graph API message body for every Message.type this processor
// can send. CTA/INTERACTIVE use WhatsApp's own native interactive-message
// types (cta_url / button) instead of plain text with a pasted link — same
// visual language WhatsApp Business accounts use for real campaigns.
// `kind: 'form'` has no WhatsApp equivalent (that's the separate "Flows"
// product) — MessagesService.sendForm() already refuses to create one for a
// non-WEBCHAT conversation, so this is a defensive fallback, not the normal
// path.
function buildOutboundBody(message: any, to: string): Record<string, unknown> {
  if (message.type === 'TEMPLATE' && message.templatePayload) {
    return { messaging_product: 'whatsapp', to, type: 'template', template: message.templatePayload };
  }

  if (message.type === 'CTA' && message.ctaPayload) {
    const { url, label } = message.ctaPayload as { url: string; label: string };
    const bodyText = message.content.replace(url, '').trim() || label;
    return {
      messaging_product: 'whatsapp',
      to,
      type: 'interactive',
      interactive: {
        type: 'cta_url',
        body: { text: bodyText },
        action: { name: 'cta_url', parameters: { display_text: label, url } },
      },
    };
  }

  if (message.type === 'INTERACTIVE' && message.interactivePayload) {
    const payload = message.interactivePayload as
      | { kind: 'quick_replies'; message: string; options: { id: string; label: string }[] }
      | { kind: 'form'; message: string; fields: { id: string; label: string }[] };

    if (payload.kind === 'quick_replies') {
      return {
        messaging_product: 'whatsapp',
        to,
        type: 'interactive',
        interactive: {
          type: 'button',
          body: { text: payload.message },
          action: {
            buttons: payload.options.map((o) => ({
              type: 'reply',
              reply: { id: o.id, title: o.label.slice(0, WHATSAPP_BUTTON_TITLE_MAX) },
            })),
          },
        },
      };
    }

    // kind === 'form' fallback — plain text listing the fields.
    const fieldList = payload.fields.map((f) => `- ${f.label}`).join('\n');
    return {
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body: `${payload.message}\n\n${fieldList}` },
    };
  }

  return { messaging_product: 'whatsapp', to, type: 'text', text: { body: message.content } };
}

/**
 * Runs entirely outside the API's NestJS DI/CLS context, so it uses the raw
 * (unscoped) Prisma client and filters by tenantId/ids manually.
 */
export async function processWhatsAppOutboundJob(data: ChannelOutboundJobData): Promise<void> {
  const { messageId } = data;

  const message = await prisma.message.findUnique({ where: { id: messageId } });
  if (!message) {
    logger.error('WhatsApp outbound job: message not found', undefined, { messageId });
    return;
  }

  const conversation = await prisma.conversation.findUnique({
    where: { id: message.conversationId },
    include: { contactChannel: true },
  });
  if (!conversation?.contactChannel) {
    logger.error('WhatsApp outbound job: no contact channel for conversation', undefined, {
      messageId,
      conversationId: message.conversationId,
    });
    return;
  }

  const connection = await prisma.metaConnection.findUnique({
    where: { tenantId_channel: { tenantId: message.tenantId, channel: 'WHATSAPP' } },
  });
  if (!connection || connection.status !== 'CONNECTED') {
    logger.error('WhatsApp outbound job: no active connection for tenant', undefined, {
      messageId,
      tenantId: message.tenantId,
    });
    return;
  }

  const body = buildOutboundBody(message, conversation.contactChannel.externalId);

  const response = await fetch(
    `https://graph.facebook.com/${GRAPH_API_VERSION}/${connection.externalAccountId}/messages`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${connection.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    },
  );

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '');
    logger.error('WhatsApp Graph API call failed', undefined, {
      messageId,
      status: response.status,
      body: errorBody,
    });
    // Throw so BullMQ marks the job failed and applies attempts/backoff.
    throw new Error(`WhatsApp Graph API call failed with status ${response.status}`);
  }

  logger.info('WhatsApp outbound message sent', {
    messageId,
    to: conversation.contactChannel.externalId,
  });
}
