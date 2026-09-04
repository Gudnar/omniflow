import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import { logger } from '@omniflow/utils';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private client!: Redis;

  async onModuleInit() {
    this.client = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
    this.client.on('error', (error) => {
      logger.error('Redis connection error', error);
    });
    await this.ping();
  }

  async onModuleDestroy() {
    await this.client?.disconnect();
  }

  async ping(): Promise<string> {
    return this.client.ping();
  }

  getClient(): Redis {
    return this.client;
  }
}
