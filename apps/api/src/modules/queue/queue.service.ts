import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Queue } from 'bullmq';
import Redis from 'ioredis';
import { Channel } from '@omniflow/database';

@Injectable()
export class QueueService implements OnModuleDestroy {
  // Dedicated connection, same construction pattern as RedisService
  // (apps/api/src/modules/redis/redis.service.ts) — not shared with it, since
  // BullMQ issues blocking commands that shouldn't interfere with unrelated
  // Redis usage.
  private connection = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
    maxRetriesPerRequest: null,
  });

  // Single queue for all channels — jobs only carry a messageId the worker
  // re-fetches full context from, so there's no per-job data justifying
  // queue-level separation per channel.
  private channelOutboundQueue = new Queue('channel-outbound', { connection: this.connection });

  // Phase 16: Workflows — one queue for both event-dispatch and node-execution
  // jobs, discriminated by `kind` (same in-process routing style apps/worker
  // already uses for channel-outbound, keyed by `channel` instead of `kind`).
  private workflowsQueue = new Queue('workflows', { connection: this.connection });

  // Phase 17: Campaigns — one job per campaign send; the worker fans out to
  // per-recipient jobs on the existing channel-outbound queue itself.
  private campaignsQueue = new Queue('campaigns', { connection: this.connection });

  // Phase 13: AI foundation — keeps the actual LLM call off the hot webhook
  // path (MessagesService.create() enqueues this for every INBOUND message,
  // same "persist minimum → emit event → queue → worker" shape as
  // enqueueWorkflowEvent). The worker just calls back into
  // /internal/ai/reply; AiReplyService decides there whether an agent
  // should actually respond.
  private aiRepliesQueue = new Queue('ai-replies', { connection: this.connection });

  // Phase 26: Voice/audio transcription — same rationale as ai-replies:
  // downloading + transcribing audio is too slow for the webhook's request
  // cycle, so MetaWebhookService enqueues this instead of calling
  // AiTranscriptionService inline.
  private transcriptionsQueue = new Queue('transcriptions', { connection: this.connection });

  // Phase 27: Facebook Page comments — replying hits a different Graph API
  // endpoint (POST /{comment_id}/comments) than the existing
  // channel-outbound queue's message-send jobs, so it gets its own queue
  // rather than overloading channelOutboundQueue's job shape.
  private facebookCommentsOutboundQueue = new Queue('facebook-comments-outbound', { connection: this.connection });

  async enqueueChannelOutboundMessage(channel: Channel, messageId: string): Promise<void> {
    await this.channelOutboundQueue.add(
      'send-message',
      { messageId, channel },
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: true,
        removeOnFail: 1000,
      },
    );
  }

  async enqueueWorkflowEvent(
    tenantId: string,
    eventType: string,
    payload: Record<string, any>,
    eventId: string,
  ): Promise<void> {
    await this.workflowsQueue.add(
      'event',
      { kind: 'event', tenantId, eventType, payload, eventId },
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: true,
        removeOnFail: 1000,
      },
    );
  }

  async enqueueWorkflowNode(
    tenantId: string,
    executionId: string,
    nodeId: string,
    delayMs?: number,
  ): Promise<void> {
    await this.workflowsQueue.add(
      'node',
      { kind: 'node', tenantId, executionId, nodeId },
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: true,
        removeOnFail: 1000,
        ...(delayMs ? { delay: delayMs } : {}),
      },
    );
  }

  async enqueueCampaignSend(campaignId: string): Promise<void> {
    await this.campaignsQueue.add(
      'campaign-send',
      { campaignId },
      {
        attempts: 2,
        backoff: { type: 'exponential', delay: 10000 },
        removeOnComplete: true,
        removeOnFail: 1000,
      },
    );
  }

  async enqueueAiReply(tenantId: string, conversationId: string, messageId: string | null): Promise<void> {
    await this.aiRepliesQueue.add(
      'reply',
      { tenantId, conversationId, messageId },
      {
        attempts: 2,
        backoff: { type: 'exponential', delay: 3000 },
        removeOnComplete: true,
        removeOnFail: 1000,
      },
    );
  }

  async enqueueTranscription(tenantId: string, messageId: string): Promise<void> {
    await this.transcriptionsQueue.add(
      'transcribe',
      { tenantId, messageId },
      {
        attempts: 2,
        backoff: { type: 'exponential', delay: 3000 },
        removeOnComplete: true,
        removeOnFail: 1000,
      },
    );
  }

  async enqueueFacebookCommentReply(tenantId: string, commentId: string, parentExternalId: string): Promise<void> {
    await this.facebookCommentsOutboundQueue.add(
      'reply',
      { tenantId, commentId, parentExternalId },
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: true,
        removeOnFail: 1000,
      },
    );
  }

  async onModuleDestroy() {
    await this.channelOutboundQueue.close();
    await this.workflowsQueue.close();
    await this.campaignsQueue.close();
    await this.aiRepliesQueue.close();
    await this.transcriptionsQueue.close();
    await this.facebookCommentsOutboundQueue.close();
    await this.connection.quit();
  }
}
