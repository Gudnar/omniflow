"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const bullmq_1 = require("bullmq");
const ioredis_1 = __importDefault(require("ioredis"));
const utils_1 = require("@omniflow/utils");
const redis = new ioredis_1.default(process.env.REDIS_URL || 'redis://localhost:6379');
const exampleQueue = new bullmq_1.Queue('example', { connection: redis });
const worker = new bullmq_1.Worker('example', async (job) => {
    utils_1.logger.info('Processing job', { jobId: job.id, data: job.data });
    await new Promise((resolve) => setTimeout(resolve, 1000));
    utils_1.logger.info('Job completed', { jobId: job.id });
    return { success: true };
}, { connection: redis, concurrency: 5 });
worker.on('completed', (job) => {
    utils_1.logger.info('Job completed event', { jobId: job.id });
});
worker.on('failed', (job, error) => {
    utils_1.logger.error('Job failed', error, { jobId: job?.id });
});
utils_1.logger.info('Worker started and listening for jobs', { queue: 'example' });
process.on('SIGTERM', async () => {
    utils_1.logger.info('SIGTERM received, shutting down worker');
    await worker.close();
    await redis.quit();
    process.exit(0);
});
//# sourceMappingURL=index.js.map