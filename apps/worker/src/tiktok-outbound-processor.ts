import { prisma } from '@omniflow/database';
import { logger } from '@omniflow/utils';
import type { ChannelOutboundJobData } from './whatsapp-outbound-processor';

/**
 * NOTE: the exact TikTok Business Messaging send-message endpoint path is
 * unverified (their portal docs weren't fully accessible at implementation
 * time) — this is a reasonable best guess, to revisit once real API access
 * exists. TikTok's documented convention uses a plain `Access-Token` header
 * rather than `Authorization: Bearer`.
 */
export async function processTikTokOutboundJob(data: ChannelOutboundJobData): Promise<void> {
  const { messageId } = data;

  const message = await prisma.message.findUnique({ where: { id: messageId } });
  if (!message) {
    logger.error('TikTok outbound job: message not found', undefined, { messageId });
    return;
  }

  const conversation = await prisma.conversation.findUnique({
    where: { id: message.conversationId },
    include: { contactChannel: true },
  });
  if (!conversation?.contactChannel) {
    logger.error('TikTok outbound job: no contact channel for conversation', undefined, {
      messageId,
      conversationId: message.conversationId,
    });
    return;
  }

  const connection = await prisma.tikTokConnection.findUnique({
    where: { tenantId: message.tenantId },
  });
  if (!connection || connection.status !== 'CONNECTED') {
    logger.error('TikTok outbound job: no active connection for tenant', undefined, {
      messageId,
      tenantId: message.tenantId,
    });
    return;
  }

  const response = await fetch(
    'https://business-api.tiktok.com/open_api/v1.3/business/messaging/send/',
    {
      method: 'POST',
      headers: {
        'Access-Token': connection.accessToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        business_id: connection.businessId,
        recipient: { open_id: conversation.contactChannel.externalId },
        message: { text: message.content },
      }),
    },
  );

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '');
    logger.error('TikTok Business API call failed', undefined, {
      messageId,
      status: response.status,
      body: errorBody,
    });
    throw new Error(`TikTok Business API call failed with status ${response.status}`);
  }

  logger.info('TikTok outbound message sent', {
    messageId,
    to: conversation.contactChannel.externalId,
  });
}
