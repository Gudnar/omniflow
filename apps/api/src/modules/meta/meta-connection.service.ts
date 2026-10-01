import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConflictError, NotFoundError, ValidationError } from '@omniflow/utils';
import { Channel } from '@omniflow/database';
import { ConnectMetaDto } from './dto/connect-meta.dto';
import { GRAPH_API_VERSION } from './meta.constants';

// Which Graph API node fields prove the token can actually read the
// connected account, and how to turn that into a message an operator
// recognizes as "yes, this is my account" — same node this.connect() stores
// as externalAccountId (phone_number_id / IG business account id / page id).
// Only the 4 channels MetaConnectionController actually routes here.
type MetaChannel = 'WHATSAPP' | 'INSTAGRAM' | 'MESSENGER' | 'FACEBOOK';

const TEST_FIELDS_BY_CHANNEL: Record<MetaChannel, string> = {
  WHATSAPP: 'display_phone_number,verified_name',
  INSTAGRAM: 'username',
  MESSENGER: 'name',
  FACEBOOK: 'name',
};

function describeSuccess(channel: MetaChannel, body: any): string {
  if (channel === 'WHATSAPP') return `Conectado como ${body.verified_name ?? 'número verificado'} (${body.display_phone_number ?? ''})`;
  if (channel === 'INSTAGRAM') return `Conectado como @${body.username}`;
  return `Conectado como ${body.name}`;
}

@Injectable()
export class MetaConnectionService {
  constructor(private prisma: PrismaService) {}

  // Read-only probe against the real Graph API — never writes to Prisma.
  // Lets the operator catch an expired token or a wrong id BEFORE connect()
  // persists it, using the exact same "keep the stored token when the field
  // is left blank" resolution connect() already relies on for edits.
  async testConnection(tenantId: string, channel: MetaChannel, dto: ConnectMetaDto) {
    const existing = await this.prisma.client.metaConnection.findUnique({
      where: { tenantId_channel: { tenantId, channel: channel as Channel } },
    });
    const accessToken = dto.accessToken || existing?.accessToken;
    if (!accessToken) {
      throw new ValidationError('accessToken is required to test this connection');
    }

    try {
      const response = await fetch(
        `https://graph.facebook.com/${GRAPH_API_VERSION}/${dto.externalAccountId}?fields=${TEST_FIELDS_BY_CHANNEL[channel]}`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
      const body: any = await response.json().catch(() => ({}));

      if (!response.ok) {
        return { ok: false, message: body?.error?.message ?? `Meta respondió con un error (${response.status})` };
      }
      return { ok: true, message: describeSuccess(channel, body) };
    } catch (error: any) {
      return { ok: false, message: `No se pudo contactar a Meta: ${error.message}` };
    }
  }

  async connect(tenantId: string, channel: Channel, dto: ConnectMetaDto) {
    // Editing an already-connected channel (fixing the display name, WABA
    // ID, or a typo) shouldn't force re-pasting the access token — only a
    // genuinely new connection requires one.
    const existing = await this.prisma.client.metaConnection.findUnique({
      where: { tenantId_channel: { tenantId, channel } },
    });
    const accessToken = dto.accessToken || existing?.accessToken;
    if (!accessToken) {
      throw new ValidationError('accessToken is required to connect this channel');
    }

    try {
      const connection = await this.prisma.client.metaConnection.upsert({
        where: { tenantId_channel: { tenantId, channel } },
        update: {
          externalAccountId: dto.externalAccountId,
          accessToken,
          displayName: dto.displayName,
          wabaId: channel === 'WHATSAPP' ? dto.wabaId : undefined,
          status: 'CONNECTED',
          connectedAt: new Date(),
        },
        create: {
          tenantId,
          channel,
          externalAccountId: dto.externalAccountId,
          accessToken,
          displayName: dto.displayName,
          wabaId: channel === 'WHATSAPP' ? dto.wabaId : undefined,
        },
      });
      return this.mask(connection);
    } catch (error: any) {
      if (error.code === 'P2002' && error.meta?.target?.includes('externalAccountId')) {
        throw new ConflictError(`This ${channel} account is already connected to another tenant`);
      }
      throw error;
    }
  }

  async get(tenantId: string, channel: Channel) {
    const connection = await this.prisma.client.metaConnection.findUnique({
      where: { tenantId_channel: { tenantId, channel } },
    });
    if (!connection) throw new NotFoundError('MetaConnection');
    return this.mask(connection);
  }

  async disconnect(tenantId: string, channel: Channel) {
    await this.get(tenantId, channel);
    const updated = await this.prisma.client.metaConnection.update({
      where: { tenantId_channel: { tenantId, channel } },
      data: { status: 'DISCONNECTED' },
    });
    return this.mask(updated);
  }

  private mask(connection: any) {
    const { accessToken, ...rest } = connection;
    return {
      ...rest,
      accessToken: `${accessToken.slice(0, 4)}${'•'.repeat(16)}`,
    };
  }
}
