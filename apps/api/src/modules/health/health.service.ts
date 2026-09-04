import { Injectable } from '@nestjs/common';
import { HealthCheckResponse } from '@omniflow/types';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class HealthService {
  constructor(
    private prismaService: PrismaService,
    private redisService: RedisService,
  ) {}

  async check(): Promise<HealthCheckResponse> {
    let databaseCheck: 'ok' | 'error' = 'ok';
    let redisCheck: 'ok' | 'error' = 'ok';

    try {
      await this.prismaService.$queryRaw`SELECT 1`;
    } catch {
      databaseCheck = 'error';
    }

    try {
      await this.redisService.ping();
    } catch {
      redisCheck = 'error';
    }

    const checks = {
      database: databaseCheck,
      redis: redisCheck,
    };

    const status =
      databaseCheck === 'ok' && redisCheck === 'ok'
        ? ('ok' as const)
        : ('degraded' as const);

    return {
      status,
      timestamp: new Date().toISOString(),
      checks,
    };
  }
}
