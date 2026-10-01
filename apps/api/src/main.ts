import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { RedisIoAdapter } from './modules/realtime/redis-io.adapter';
import { logger } from '@omniflow/utils';

function validateEnvironment() {
  const requiredEnvs = ['JWT_ACCESS_SECRET', 'DATABASE_URL', 'REDIS_URL'];
  const missing = requiredEnvs.filter((env) => !process.env[env]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}

async function bootstrap() {
  validateEnvironment();
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { rawBody: true });

  // Serves apps/api/uploads/** (local disk storage — see StorageService)
  // at /uploads/** so an uploaded image's returned URL is directly loadable.
  app.useStaticAssets(join(process.cwd(), 'uploads'), { prefix: '/uploads/' });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.useGlobalFilters(new AllExceptionsFilter());

  // RedisService's connection is only actually opened by its onModuleInit
  // hook, which NestJS only runs once the app context is initialized —
  // app.listen() does that internally, but too late for a WebSocket adapter
  // that must be attached before listen(). Calling app.init() explicitly
  // here runs those hooks now (app.listen() below then sees it's already
  // initialized and just starts the HTTP server).
  await app.init();

  const redisIoAdapter = new RedisIoAdapter(app);
  await redisIoAdapter.connectToRedis();
  app.useWebSocketAdapter(redisIoAdapter);

  const port = process.env.PORT || 3000;
  await app.listen(port);
  logger.info(`API server listening on port ${port}`);
}

bootstrap().catch((error) => {
  logger.error('Failed to start API server', error);
  process.exit(1);
});
