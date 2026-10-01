import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConflictError, NotFoundError, ValidationError } from '@omniflow/utils';
import { ConnectTikTokDto } from './dto/connect-tiktok.dto';

@Injectable()
export class TikTokConnectionService {
  constructor(private prisma: PrismaService) {}

  async connect(tenantId: string, dto: ConnectTikTokDto) {
    // Same "editing shouldn't force re-pasting secrets" rationale as
    // MetaConnectionService.connect().
    const existing = await this.prisma.client.tikTokConnection.findUnique({ where: { tenantId } });
    const accessToken = dto.accessToken || existing?.accessToken;
    const refreshToken = dto.refreshToken || existing?.refreshToken;
    if (!accessToken || !refreshToken) {
      throw new ValidationError('accessToken and refreshToken are required to connect TikTok');
    }

    try {
      const connection = await this.prisma.client.tikTokConnection.upsert({
        where: { tenantId },
        update: {
          businessId: dto.businessId,
          clientKey: dto.clientKey,
          accessToken,
          refreshToken,
          status: 'CONNECTED',
          connectedAt: new Date(),
        },
        create: {
          tenantId,
          businessId: dto.businessId,
          clientKey: dto.clientKey,
          accessToken,
          refreshToken,
        },
      });
      return this.mask(connection);
    } catch (error: any) {
      if (error.code === 'P2002' && error.meta?.target?.includes('businessId')) {
        throw new ConflictError('This TikTok business account is already connected to another tenant');
      }
      throw error;
    }
  }

  async get(tenantId: string) {
    const connection = await this.prisma.client.tikTokConnection.findUnique({ where: { tenantId } });
    if (!connection) throw new NotFoundError('TikTokConnection');
    return this.mask(connection);
  }

  // Read-only probe, never writes to Prisma — same "keep the stored token
  // when the field is left blank" resolution connect() uses for edits.
  // NOTE: same caveat as apps/worker/src/tiktok-outbound-processor.ts — the
  // exact TikTok Business API endpoint is an unverified best guess (their
  // docs weren't fully accessible at implementation time), including the
  // plain `Access-Token` header (not `Authorization: Bearer`).
  async testConnection(tenantId: string, dto: ConnectTikTokDto) {
    const existing = await this.prisma.client.tikTokConnection.findUnique({ where: { tenantId } });
    const accessToken = dto.accessToken || existing?.accessToken;
    if (!accessToken) {
      throw new ValidationError('accessToken is required to test this connection');
    }

    try {
      const response = await fetch(
        `https://business-api.tiktok.com/open_api/v1.3/business/get/?business_id=${dto.businessId}`,
        { headers: { 'Access-Token': accessToken } },
      );
      const body: any = await response.json().catch(() => ({}));

      if (!response.ok) {
        return { ok: false, message: body?.message ?? `TikTok respondió con un error (${response.status})` };
      }
      return { ok: true, message: 'Token válido para TikTok Business' };
    } catch (error: any) {
      return { ok: false, message: `No se pudo contactar a TikTok: ${error.message}` };
    }
  }

  async disconnect(tenantId: string) {
    await this.get(tenantId);
    const updated = await this.prisma.client.tikTokConnection.update({
      where: { tenantId },
      data: { status: 'DISCONNECTED' },
    });
    return this.mask(updated);
  }

  private mask(connection: any) {
    const { accessToken, refreshToken, ...rest } = connection;
    return {
      ...rest,
      accessToken: `${accessToken.slice(0, 4)}${'•'.repeat(16)}`,
      refreshToken: `${refreshToken.slice(0, 4)}${'•'.repeat(16)}`,
    };
  }
}
