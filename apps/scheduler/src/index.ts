import * as cron from 'node-cron';
import { logger } from '@omniflow/utils';

logger.info('Scheduler started');

cron.schedule('*/5 * * * *', () => {
  logger.info('Heartbeat - scheduler is running', {
    timestamp: new Date().toISOString(),
  });
});

logger.info('Scheduler ready', {
  jobs: ['heartbeat (every 5 minutes)'],
});

process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down scheduler');
  process.exit(0);
});
