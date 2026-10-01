import { prisma } from '@omniflow/database';
import { logger } from '@omniflow/utils';

const GRAPH_API_VERSION = 'v19.0';

export interface ChannelOutboundJobData {
  messageId: string;
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

  // Phase 17: Campaigns/Templates — a TEMPLATE message carries a pre-built
  // Graph API `template` object (snapshotted at creation time, see
  // Message.templatePayload), sent instead of a plain-text payload. This is
  // the only branch point; everything else (connection lookup, retry/DLQ via
  // the thrown Error below) is shared with ordinary text sends.
  const body =
    message.type === 'TEMPLATE' && message.templatePayload
      ? {
          messaging_product: 'whatsapp',
          to: conversation.contactChannel.externalId,
          type: 'template',
          template: message.templatePayload,
        }
      : {
          messaging_product: 'whatsapp',
          to: conversation.contactChannel.externalId,
          type: 'text',
          text: { body: message.content },
        };

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
