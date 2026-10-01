import { Controller, Get, Post, Req, Res, Headers, HttpCode, RawBodyRequest } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { Public } from '../auth/decorators';
import { MetaWebhookService } from './meta-webhook.service';
import { verifyMetaSignature } from './utils/verify-meta-signature';
import { logger } from '@omniflow/utils';

// Single endpoint for the whole Meta App (WhatsApp + Instagram + Messenger) —
// this mirrors how Meta itself only lets you register one webhook URL per
// App, subscribed to multiple products and disambiguated by `body.object`.
@Controller('webhooks/meta')
export class MetaWebhookController {
  constructor(private webhookService: MetaWebhookService) {}

  @Public()
  @SkipThrottle()
  @Get()
  @HttpCode(200)
  verify(@Req() req: Request, @Res() res: Response) {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];
    const expected = process.env.META_WEBHOOK_VERIFY_TOKEN;

    if (mode === 'subscribe' && expected && token === expected) {
      return res.status(200).type('text/plain').send(challenge);
    }
    return res.status(403).send();
  }

  @Public()
  @SkipThrottle()
  @Post()
  @HttpCode(200)
  async receive(
    @Req() req: RawBodyRequest<Request>,
    @Headers('x-hub-signature-256') signature: string | undefined,
    @Res() res: Response,
  ) {
    const appSecret = process.env.META_APP_SECRET;
    if (!verifyMetaSignature(req.rawBody, signature, appSecret)) {
      return res.status(401).send();
    }

    try {
      await this.webhookService.handlePayload(req.body);
    } catch (error) {
      logger.error('Unhandled error processing Meta webhook', error as Error);
    }

    return res.status(200).send('EVENT_RECEIVED');
  }
}
