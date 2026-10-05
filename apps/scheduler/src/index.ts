// Must run before any other import touches process.env — see the matching
// comment in apps/worker/src/index.ts for why this is needed here too.
import 'dotenv/config';
import * as cron from 'node-cron';
import Redis from 'ioredis';
import { logger } from '@omniflow/utils';
import { startFlowScheduleRefresh } from './flow-schedules';
import { startAbandonedCartScan } from './abandoned-carts';
import { startScheduledCampaignsRefresh } from './scheduled-campaigns';

logger.info('Scheduler started');

cron.schedule('*/5 * * * *', () => {
  logger.info('Heartbeat - scheduler is running', {
    timestamp: new Date().toISOString(),
  });
});

// Phase 16: Workflows — SCHEDULE-trigger flows and the cart-abandonment scan
// both need to enqueue jobs onto the API's `workflows` BullMQ queue.
const connection = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
});

startFlowScheduleRefresh(connection);
startAbandonedCartScan(connection);
startScheduledCampaignsRefresh(connection);

logger.info('Scheduler ready', {
  jobs: [
    'heartbeat (every 5 minutes)',
    'flow schedule refresh (every 5 minutes)',
    'abandoned-cart scan (every 15 minutes)',
    'scheduled campaigns refresh (every 5 minutes)',
  ],
});

process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down scheduler');
  await connection.quit();
  process.exit(0);
});
