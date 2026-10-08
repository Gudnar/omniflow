// Must run before any other import touches process.env — unlike apps/api
// (NestJS's ConfigModule loads .env for it), this is a plain Node script
// with nothing else reading the .env file, so every env-dependent constant
// below (and in every processor module it imports) would otherwise silently
// fall back to its hardcoded default.
import 'dotenv/config';
import { Worker } from 'bullmq';
import Redis from 'ioredis';
import { logger } from '@omniflow/utils';
import { processWhatsAppOutboundJob, type ChannelOutboundJobData } from './whatsapp-outbound-processor';
import { processInstagramOutboundJob } from './instagram-outbound-processor';
import { processFacebookOutboundJob } from './facebook-outbound-processor';
import { processTikTokOutboundJob } from './tiktok-outbound-processor';
import { createFlowProcessor, markExecutionFailedIfExhausted, type WorkflowJobData } from './flow-processor';
import { createCampaignProcessor, finalizeCampaignRecipient } from './campaign-processor';
import { processAiReplyJob, type AiReplyJobData } from './ai-processor';
import { processTranscriptionJob, type TranscriptionJobData } from './transcription-processor';
import { processFacebookCommentReplyJob, type FacebookCommentReplyJobData } from './facebook-comment-reply-processor';
import { processDeliveryNotifyJob, type DeliveryNotifyJobData } from './delivery-notify-processor';

const connection = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
});

interface ChannelOutboundJob extends ChannelOutboundJobData {
  channel: 'WHATSAPP' | 'INSTAGRAM' | 'MESSENGER' | 'TIKTOK';
}

const processorsByChannel: Record<ChannelOutboundJob['channel'], (data: ChannelOutboundJobData) => Promise<void>> = {
  WHATSAPP: processWhatsAppOutboundJob,
  INSTAGRAM: processInstagramOutboundJob,
  MESSENGER: processFacebookOutboundJob,
  TIKTOK: processTikTokOutboundJob,
};

const worker = new Worker<ChannelOutboundJob>(
  'channel-outbound',
  async (job) => {
    logger.info('Processing channel outbound job', { jobId: job.id, data: job.data });

    const processor = processorsByChannel[job.data.channel];
    if (!processor) {
      logger.error('Channel outbound job: no processor for channel', undefined, {
        jobId: job.id,
        channel: job.data.channel,
      });
      return;
    }

    await processor(job.data);
    logger.info('Channel outbound job completed', { jobId: job.id, channel: job.data.channel });
  },
  { connection, concurrency: 5 },
);

worker.on('completed', (job) => {
  logger.info('Job completed event', { jobId: job.id });
  // Phase 17: Campaigns — a no-op for any non-campaign message
  // (finalizeCampaignRecipient checks message.campaignId itself).
  finalizeCampaignRecipient(job.data.messageId, 'SENT').catch((err) =>
    logger.error('Failed to finalize campaign recipient (SENT)', err, { messageId: job.data.messageId }),
  );
});

worker.on('failed', (job, error) => {
  logger.error('Job failed', error, { jobId: job?.id, attemptsMade: job?.attemptsMade });
  if (job && job.attemptsMade >= (job.opts.attempts ?? 1)) {
    finalizeCampaignRecipient(job.data.messageId, 'FAILED', error.message).catch((err) =>
      logger.error('Failed to finalize campaign recipient (FAILED)', err, { messageId: job.data.messageId }),
    );
  }
});

// Phase 16: Workflows — a second Worker instance on its own queue, same
// "one Worker per queue name, sharing the connection" pattern as above.
const processWorkflowJob = createFlowProcessor(connection);

const workflowsWorker = new Worker<WorkflowJobData>(
  'workflows',
  async (job) => {
    await processWorkflowJob(job.data);
  },
  { connection, concurrency: 5 },
);

workflowsWorker.on('completed', (job) => {
  logger.info('Workflow job completed', { jobId: job.id, kind: job.data.kind });
});

workflowsWorker.on('failed', async (job, error) => {
  logger.error('Workflow job failed', error, { jobId: job?.id, attemptsMade: job?.attemptsMade });
  if (job) {
    const maxAttempts = job.opts.attempts ?? 1;
    await markExecutionFailedIfExhausted(job.data, job.attemptsMade, maxAttempts, error.message).catch((err) =>
      logger.error('Failed to mark FlowExecution as FAILED', err),
    );
  }
});

// Phase 17: Campaigns — a third Worker instance, same "one Worker per queue
// name, sharing the connection" pattern as above.
const processCampaignSend = createCampaignProcessor(connection);

const campaignsWorker = new Worker<{ campaignId: string }>(
  'campaigns',
  async (job) => {
    await processCampaignSend(job.data);
  },
  { connection, concurrency: 2 },
);

campaignsWorker.on('completed', (job) => {
  logger.info('Campaign send job completed', { jobId: job.id, campaignId: job.data.campaignId });
});

campaignsWorker.on('failed', (job, error) => {
  logger.error('Campaign send job failed', error, { jobId: job?.id, campaignId: job?.data.campaignId });
});

// Phase 13: AI foundation — a fourth Worker instance, same "one Worker per
// queue name, sharing the connection" pattern as above.
const aiRepliesWorker = new Worker<AiReplyJobData>(
  'ai-replies',
  async (job) => {
    await processAiReplyJob(job.data);
  },
  { connection, concurrency: 5 },
);

aiRepliesWorker.on('completed', (job) => {
  logger.info('AI reply job completed', { jobId: job.id, conversationId: job.data.conversationId });
});

aiRepliesWorker.on('failed', (job, error) => {
  logger.error('AI reply job failed', error, { jobId: job?.id, conversationId: job?.data.conversationId });
});

// Phase 26: Voice/audio transcription — a fifth Worker instance, same
// pattern as above.
const transcriptionsWorker = new Worker<TranscriptionJobData>(
  'transcriptions',
  async (job) => {
    await processTranscriptionJob(job.data);
  },
  { connection, concurrency: 5 },
);

transcriptionsWorker.on('completed', (job) => {
  logger.info('Transcription job completed', { jobId: job.id, messageId: job.data.messageId });
});

transcriptionsWorker.on('failed', (job, error) => {
  logger.error('Transcription job failed', error, { jobId: job?.id, messageId: job?.data.messageId });
});

// Phase 27: Facebook Page comments — a sixth Worker instance, same pattern
// as above.
const facebookCommentsOutboundWorker = new Worker<FacebookCommentReplyJobData>(
  'facebook-comments-outbound',
  async (job) => {
    await processFacebookCommentReplyJob(job.data);
  },
  { connection, concurrency: 5 },
);

facebookCommentsOutboundWorker.on('completed', (job) => {
  logger.info('Facebook comment reply job completed', { jobId: job.id, commentId: job.data.commentId });
});

facebookCommentsOutboundWorker.on('failed', (job, error) => {
  logger.error('Facebook comment reply job failed', error, { jobId: job?.id, commentId: job?.data.commentId });
});

// Fase 20: notificación de entrega por Telegram — mismo patrón de arriba.
const deliveryNotifyWorker = new Worker<DeliveryNotifyJobData>(
  'delivery-notify',
  async (job) => {
    await processDeliveryNotifyJob(job.data);
  },
  { connection, concurrency: 5 },
);

deliveryNotifyWorker.on('completed', (job) => {
  logger.info('Delivery notify job completed', { jobId: job.id, stopId: job.data.stopId });
});

deliveryNotifyWorker.on('failed', (job, error) => {
  logger.error('Delivery notify job failed', error, { jobId: job?.id, stopId: job?.data.stopId });
});

logger.info('Worker started and listening for jobs', {
  queues: [
    'channel-outbound',
    'workflows',
    'campaigns',
    'ai-replies',
    'transcriptions',
    'facebook-comments-outbound',
    'delivery-notify',
  ],
});

process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down worker');
  await worker.close();
  await workflowsWorker.close();
  await campaignsWorker.close();
  await aiRepliesWorker.close();
  await transcriptionsWorker.close();
  await facebookCommentsOutboundWorker.close();
  await deliveryNotifyWorker.close();
  await connection.quit();
  process.exit(0);
});
