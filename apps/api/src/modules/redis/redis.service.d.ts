import { OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
export declare class RedisService implements OnModuleInit, OnModuleDestroy {
    private client;
    onModuleInit(): Promise<void>;
    onModuleDestroy(): Promise<void>;
    ping(): Promise<string>;
    getClient(): Redis;
}
//# sourceMappingURL=redis.service.d.ts.map