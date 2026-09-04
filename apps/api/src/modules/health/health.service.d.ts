import { HealthCheckResponse } from '@omniflow/types';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
export declare class HealthService {
    private prismaService;
    private redisService;
    constructor(prismaService: PrismaService, redisService: RedisService);
    check(): Promise<HealthCheckResponse>;
}
//# sourceMappingURL=health.service.d.ts.map