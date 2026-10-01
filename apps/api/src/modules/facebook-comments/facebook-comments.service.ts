import { Injectable } from '@nestjs/common';
import { logger } from '@omniflow/utils';
import { NotFoundError, ValidationError } from '@omniflow/utils';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContextService } from '../tenant-context/tenant-context.service';
import { QueueService } from '../queue/queue.service';
import { ReplyCommentDto } from './dto/reply-comment.dto';

const GRAPH_API_VERSION = 'v19.0';

// Phase 27: Facebook Page comments. Deliberately separate from
// ConversationsModule/MessagesService — see the schema comment on Post/
// Comment for why a public comment thread doesn't fit the 1:1
// Conversation-with-a-Contact model.
@Injectable()
export class FacebookCommentsService {
  constructor(
    private prisma: PrismaService,
    private tenantContext: TenantContextService,
    private queueService: QueueService,
  ) {}

  async list() {
    return this.prisma.client.post.findMany({
      include: { comments: { orderBy: { createdAt: 'asc' } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async reply(commentId: string, dto: ReplyCommentDto) {
    const target = await this.prisma.client.comment.findUnique({ where: { id: commentId } });
    if (!target) throw new NotFoundError('Comment');
    if (!target.externalId) {
      throw new ValidationError('Cannot reply to a comment that has not finished sending yet');
    }

    const created = await this.prisma.client.comment.create({
      data: {
        postId: target.postId,
        parentId: target.id,
        direction: 'OUTBOUND',
        message: dto.message,
      },
    });

    await this.queueService.enqueueFacebookCommentReply((target as any).tenantId, created.id, target.externalId);

    return created;
  }

  // Invoked from MetaWebhookService for entry.changes[].field === 'feed'.
  async handleFeedChange(pageId: string | undefined, value: any): Promise<void> {
    if (!pageId) return;
    // Ignore likes, post edits, and anything else the `feed` field also
    // reports — only new comments are in scope for this phase.
    if (value?.item !== 'comment' || value?.verb !== 'add') return;

    const commentExternalId = value.comment_id;
    if (!commentExternalId) return;

    const connection = await this.resolveConnection(pageId);
    if (!connection) return;

    // Our own reply gets echoed back through this same webhook — never
    // re-ingest it as a new INBOUND comment. This is a defense-in-depth
    // check on top of the externalId dedup below (belt and suspenders
    // against the send-confirmation write and this echo racing).
    if (value.from?.id === pageId) return;

    const existing = await this.prisma.raw.comment.findUnique({ where: { externalId: commentExternalId } });
    if (existing) {
      logger.info('Facebook comments webhook: duplicate comment, skipping', { externalId: commentExternalId });
      return;
    }

    const post = await this.findOrCreatePost(value.post_id, connection.accessToken);

    const parentComment =
      value.parent_id && value.parent_id !== value.post_id
        ? await this.prisma.client.comment.findFirst({ where: { externalId: value.parent_id } })
        : null;

    await this.prisma.client.comment.create({
      data: {
        postId: post.id,
        externalId: commentExternalId,
        parentId: parentComment?.id,
        direction: 'INBOUND',
        authorExternalId: value.from?.id,
        authorName: value.from?.name,
        message: value.message ?? '',
      },
    });
  }

  private async resolveConnection(pageId: string) {
    // Cross-tenant lookup by Meta's own page id — same rationale as
    // MetaWebhookService.resolveConnection.
    const connection = await this.prisma.raw.metaConnection.findUnique({
      where: { channel_externalAccountId: { channel: 'FACEBOOK', externalAccountId: pageId } },
    });
    if (!connection) {
      logger.warn('Facebook comments webhook: no connection for page id', { pageId });
      return null;
    }
    this.tenantContext.setContext({ tenantId: connection.tenantId });
    return connection;
  }

  // Fetched once, best-effort, the first time we see a post's id (i.e. its
  // first comment) — never refreshed afterward.
  private async findOrCreatePost(externalId: string, accessToken: string) {
    const existing = await this.prisma.client.post.findFirst({ where: { externalId } });
    if (existing) return existing;

    let message: string | undefined;
    let permalink: string | undefined;
    try {
      const response = await fetch(`https://graph.facebook.com/${GRAPH_API_VERSION}/${externalId}?fields=message,permalink_url`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (response.ok) {
        const data: any = await response.json();
        message = data.message;
        permalink = data.permalink_url;
      }
    } catch (error) {
      logger.error('Facebook comments webhook: failed fetching post details', error as Error, { externalId });
    }

    return this.prisma.client.post.create({ data: { externalId, message, permalink } });
  }
}
