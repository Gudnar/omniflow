import { prisma } from '@omniflow/database';
import { logger } from '@omniflow/utils';
import type { ChannelOutboundJobData } from './whatsapp-outbound-processor';

const GRAPH_API_VERSION = 'v19.0';

/**
 * Instagram DMs are sent through the linked Page's access token via the
 * IG business account id, same Graph API surface as WhatsApp.
 */
export async function processInstagramOutboundJob(data: ChannelOutboundJobData): Promise<void> {
  const { messageId } = data;

  const message = await prisma.message.findUnique({ where: { id: messageId } });
  if (!message) {
    logger.error('Instagram outbound job: message not found', undefined, { messageId });
    return;
  }

  const conversation = await prisma.conversation.findUnique({
    where: { id: message.conversationId },
    include: { contactChannel: true },
  });
  if (!conversation?.contactChannel) {
    logger.error('Instagram outbound job: no contact channel for conversation', undefined, {
      messageId,
      conversationId: message.conversationId,
    });
    return;
  }

  const connection = await prisma.metaConnection.findUnique({
    where: { tenantId_channel: { tenantId: message.tenantId, channel: 'INSTAGRAM' } },
  });
  if (!connection || connection.status !== 'CONNECTED') {
    logger.error('Instagram outbound job: no active connection for tenant', undefined, {
      messageId,
      tenantId: message.tenantId,
    });
    return;
  }

  const response = await fetch(
    `https://graph.facebook.com/${GRAPH_API_VERSION}/${connection.externalAccountId}/messages`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${connection.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        recipient: { id: conversation.contactChannel.externalId },
        message: { text: message.content },
      }),
    },
  );

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '');
    logger.error('Instagram Graph API call failed', undefined, {
      messageId,
      status: response.status,
      body: errorBody,
    });
    throw new Error(`Instagram Graph API call failed with status ${response.status}`);
  }

  logger.info('Instagram outbound message sent', {
    messageId,
    to: conversation.contactChannel.externalId,
  });
}
