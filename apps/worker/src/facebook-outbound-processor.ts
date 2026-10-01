import { prisma } from '@omniflow/database';
import { logger } from '@omniflow/utils';
import type { ChannelOutboundJobData } from './whatsapp-outbound-processor';

const GRAPH_API_VERSION = 'v19.0';

/**
 * Facebook Messenger DMs (stored internally as Channel.MESSENGER — see
 * apps/api/src/modules/meta/meta-connection.controller.ts for the same
 * route-name-vs-stored-channel mapping) are sent via the Page's own
 * `/me/messages` endpoint, authenticated with the Page's access token.
 */
export async function processFacebookOutboundJob(data: ChannelOutboundJobData): Promise<void> {
  const { messageId } = data;

  const message = await prisma.message.findUnique({ where: { id: messageId } });
  if (!message) {
    logger.error('Facebook Messenger outbound job: message not found', undefined, { messageId });
    return;
  }

  const conversation = await prisma.conversation.findUnique({
    where: { id: message.conversationId },
    include: { contactChannel: true },
  });
  if (!conversation?.contactChannel) {
    logger.error('Facebook Messenger outbound job: no contact channel for conversation', undefined, {
      messageId,
      conversationId: message.conversationId,
    });
    return;
  }

  const connection = await prisma.metaConnection.findUnique({
    where: { tenantId_channel: { tenantId: message.tenantId, channel: 'MESSENGER' } },
  });
  if (!connection || connection.status !== 'CONNECTED') {
    logger.error('Facebook Messenger outbound job: no active connection for tenant', undefined, {
      messageId,
      tenantId: message.tenantId,
    });
    return;
  }

  const response = await fetch(
    `https://graph.facebook.com/${GRAPH_API_VERSION}/me/messages`,
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
    logger.error('Facebook Messenger Graph API call failed', undefined, {
      messageId,
      status: response.status,
      body: errorBody,
    });
    throw new Error(`Facebook Messenger Graph API call failed with status ${response.status}`);
  }

  logger.info('Facebook Messenger outbound message sent', {
    messageId,
    to: conversation.contactChannel.externalId,
  });
}
