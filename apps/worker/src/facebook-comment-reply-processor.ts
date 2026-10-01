import { prisma } from '@omniflow/database';
import { logger } from '@omniflow/utils';

const GRAPH_API_VERSION = 'v19.0';

export interface FacebookCommentReplyJobData {
  tenantId: string;
  commentId: string;
  parentExternalId: string;
}

// Phase 27: Facebook Page comments — POST /{comment_id}/comments creates a
// public reply, a different Graph API surface than Messenger's
// /me/messages (see facebook-outbound-processor.ts). Runs raw/unscoped, same
// convention as every other outbound processor in this worker.
export async function processFacebookCommentReplyJob(data: FacebookCommentReplyJobData): Promise<void> {
  const { tenantId, commentId, parentExternalId } = data;

  const comment = await prisma.comment.findUnique({ where: { id: commentId } });
  if (!comment || comment.tenantId !== tenantId) {
    logger.error('Facebook comment reply job: comment not found', undefined, { commentId });
    return;
  }

  const connection = await prisma.metaConnection.findUnique({
    where: { tenantId_channel: { tenantId, channel: 'FACEBOOK' } },
  });
  if (!connection || connection.status !== 'CONNECTED') {
    logger.error('Facebook comment reply job: no active connection for tenant', undefined, { tenantId, commentId });
    return;
  }

  const response = await fetch(`https://graph.facebook.com/${GRAPH_API_VERSION}/${parentExternalId}/comments`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${connection.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ message: comment.message }),
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '');
    logger.error('Facebook comment reply Graph API call failed', undefined, {
      commentId,
      status: response.status,
      body: errorBody,
    });
    throw new Error(`Facebook comment reply Graph API call failed with status ${response.status}`);
  }

  const result: any = await response.json();
  await prisma.comment.update({ where: { id: commentId }, data: { externalId: result.id } });

  logger.info('Facebook comment reply sent', { commentId, externalId: result.id });
}
