import { Injectable } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundError, ValidationError, encryptSecret } from '@omniflow/utils';
import { ConnectMetaAppDto } from './dto/connect-meta-app.dto';

function apiPublicUrl(): string {
  return process.env.API_PUBLIC_URL ?? `http://localhost:${process.env.PORT || 3000}`;
}

// Opción B: cada tenant trae su propia App de Meta (sin depender de la
// revisión/App Review de Meta, a diferencia de la Opción A compartida, aún
// no construida). Una sola credencial por tenant — la misma App cubre
// WhatsApp + Instagram + Messenger + Facebook Comentarios, se configura una
// sola vez (ver MetaWebhookController./c/:webhookPathId).
@Injectable()
export class TenantMetaAppService {
  constructor(private prisma: PrismaService) {}

  async connect(tenantId: string, dto: ConnectMetaAppDto) {
    const existing = await this.prisma.client.tenantMetaAppCredential.findUnique({ where: { tenantId } });
    if (!dto.appSecret && !existing) {
      throw new ValidationError('appSecret is required to connect your Meta App');
    }

    // Generated once and never regenerated on a later edit — the operator
    // already pasted this URL/token into their Meta App's webhook config;
    // rotating it on every save would silently break that subscription.
    const webhookPathId = existing?.webhookPathId ?? randomBytes(16).toString('hex');
    const webhookVerifyToken = existing?.webhookVerifyToken ?? randomBytes(24).toString('hex');

    const credential = await this.prisma.client.tenantMetaAppCredential.upsert({
      where: { tenantId },
      update: {
        appId: dto.appId,
        ...(dto.appSecret && { appSecretEncrypted: encryptSecret(dto.appSecret) }),
      },
      create: {
        tenantId,
        appId: dto.appId,
        appSecretEncrypted: encryptSecret(dto.appSecret ?? ''),
        webhookPathId,
        webhookVerifyToken,
      },
    });
    return this.toPublicShape(credential);
  }

  async get(tenantId: string) {
    const credential = await this.prisma.client.tenantMetaAppCredential.findUnique({ where: { tenantId } });
    if (!credential) throw new NotFoundError('TenantMetaAppCredential');
    return this.toPublicShape(credential);
  }

  async disconnect(tenantId: string) {
    await this.get(tenantId);
    await this.prisma.client.tenantMetaAppCredential.delete({ where: { tenantId } });
    return { success: true };
  }

  // Internal-only: resolved by MetaWebhookController to verify an inbound
  // request against this tenant's own secret/token — never exposed over the
  // client-facing get() above.
  async findByWebhookPathId(webhookPathId: string) {
    return this.prisma.client.tenantMetaAppCredential.findUnique({ where: { webhookPathId } });
  }

  // The App Secret itself is never returned to the client, not even masked —
  // there's no legitimate reason to display it again once saved (unlike an
  // access token, it's never shown back for copy/paste elsewhere).
  private toPublicShape(credential: any) {
    return {
      appId: credential.appId,
      webhookUrl: `${apiPublicUrl()}/webhooks/meta/c/${credential.webhookPathId}`,
      webhookVerifyToken: credential.webhookVerifyToken,
    };
  }
}
