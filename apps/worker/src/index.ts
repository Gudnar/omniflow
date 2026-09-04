import { Worker, Queue } from 'bullmq';
import Redis from 'ioredis';
import { logger } from '@omniflow/utils';

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

const exampleQueue = new Queue('example', { connection: redis });

const worker = new Worker(
  'example',
  async (job) => {
    logger.info('Processing job', { jobId: job.id, data: job.data });
    await new Promise((resolve) => setTimeout(resolve, 1000));
    logger.info('Job completed', { jobId: job.id });
    return { success: true };
  },
  { connection: redis, concurrency: 5 },
);

worker.on('completed', (job) => {
  logger.info('Job completed event', { jobId: job.id });
});

worker.on('failed', (job, error) => {
  logger.error('Job failed', error, { jobId: job?.id });
});

logger.info('Worker started and listening for jobs', { queue: 'example' });

process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down worker');
  await worker.close();
  await redis.quit();
  process.exit(0);
});
