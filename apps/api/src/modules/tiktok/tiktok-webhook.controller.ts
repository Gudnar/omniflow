import { Controller, Get, Post, Req, Res, Headers, HttpCode, RawBodyRequest } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { Public } from '../auth/decorators';
import { TikTokWebhookService } from './tiktok-webhook.service';
import { parseTikTokSignatureHeader, isTikTokSignatureValid, isTikTokTimestampFresh } from './utils/verify-tiktok-signature';
import { logger } from '@omniflow/utils';

@Controller('webhooks/tiktok')
export class TikTokWebhookController {
  constructor(private webhookService: TikTokWebhookService) {}

  // TikTok has no live GET handshake — the webhook URL is registered and
  // confirmed via the Developer Portal, not a challenge request. A
  // defensive 405 here documents that on purpose, instead of leaving GET to
  // fall through to an ambiguous default 404.
  @Public()
  @SkipThrottle()
  @Get()
  @HttpCode(405)
  handshakeNotSupported() {
    return { message: 'TikTok webhooks are verified via the Developer Portal; no GET handshake is served here.' };
  }

  @Public()
  @SkipThrottle()
  @Post()
  @HttpCode(200)
  async receive(
    @Req() req: RawBodyRequest<Request>,
    @Headers('tiktok-signature') signatureHeader: string | undefined,
    @Res() res: Response,
  ) {
    const clientSecret = process.env.TIKTOK_CLIENT_SECRET;

    const parsed = parseTikTokSignatureHeader(signatureHeader);
    if (!parsed) {
      return res.status(401).send();
    }

    if (!isTikTokSignatureValid(req.rawBody, parsed.timestamp, parsed.signature, clientSecret)) {
      logger.warn('TikTok webhook: invalid signature (tampered or wrong secret)');
      return res.status(401).send();
    }

    if (!isTikTokTimestampFresh(parsed.timestamp)) {
      logger.warn('TikTok webhook: valid signature but stale timestamp (possible replay)', {
        timestamp: parsed.timestamp,
      });
      return res.status(401).send();
    }

    try {
      await this.webhookService.handlePayload(req.body);
    } catch (error) {
      logger.error('Unhandled error processing TikTok webhook', error as Error);
    }

    return res.status(200).send('EVENT_RECEIVED');
  }
}
