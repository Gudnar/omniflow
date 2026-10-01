import { IoAdapter } from '@nestjs/platform-socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import type { ServerOptions } from 'socket.io';
import type { INestApplicationContext } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';

// Makes a `message:new` emit from RealtimeGateway reach a client connected
// to ANY API instance, not just the one that happened to handle the HTTP
// request that created the message — required for this to be correct once
// the API runs behind a load balancer with more than one instance. A
// no-op-equivalent improvement in today's single-instance dev setup, but
// without it this "real-time" feature would quietly break the moment the
// API scales horizontally.
export class RedisIoAdapter extends IoAdapter {
  private adapterConstructor?: ReturnType<typeof createAdapter>;

  constructor(private app: INestApplicationContext) {
    super(app);
  }

  async connectToRedis(): Promise<void> {
    const redisService = this.app.get(RedisService);
    const pubClient = redisService.getClient().duplicate();
    const subClient = pubClient.duplicate();
    this.adapterConstructor = createAdapter(pubClient, subClient);
  }

  createIOServer(port: number, options?: ServerOptions) {
    const server = super.createIOServer(port, options);
    if (this.adapterConstructor) {
      server.adapter(this.adapterConstructor);
    }
    return server;
  }
}
