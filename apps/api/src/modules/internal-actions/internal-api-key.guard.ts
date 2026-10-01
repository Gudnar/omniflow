import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';

/**
 * Guards the /internal/flows/actions/* surface that apps/worker calls into
 * to run flow actions (Phase 16: Workflows). These routes are marked
 * @Public() to bypass the global JwtAuthGuard (there's no end-user JWT for a
 * server-to-server call), so this shared-secret check is the only auth layer
 * — same "verify a secret before trusting the payload" shape as a webhook
 * signature check, just symmetric instead of HMAC since both sides are ours.
 *
 * Never expose these routes' path prefix through any public-facing proxy —
 * the worker must reach the API directly on its internal address.
 */
@Injectable()
export class InternalApiKeyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const provided = request.headers['x-internal-secret'];
    const expected = process.env.WORKER_INTERNAL_SECRET || 'dev-internal-secret';

    if (!provided || provided !== expected) {
      throw new UnauthorizedException('Invalid internal secret');
    }
    return true;
  }
}
