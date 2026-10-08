import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ValidationError } from '@omniflow/utils';
import { encryptSecret } from '@omniflow/utils';
import { UpsertDeliveryProviderConfigDto } from './delivery-provider-config.dto';

// Never return botTokenEncrypted — same "don't leak secrets back to the
// client" rule as TenantMetaAppService's own credentials.
function serialize(config: any) {
  const { botTokenEncrypted, ...rest } = config;
  return { ...rest, hasBotToken: !!botTokenEncrypted };
}

@Injectable()
export class DeliveryProviderConfigService {
  constructor(private prisma: PrismaService) {}

  async list(tenantId: string) {
    const configs = await this.prisma.client.deliveryProviderConfig.findMany({
      where: { tenantId },
      orderBy: { branchId: 'asc' },
    });
    return configs.map(serialize);
  }

  // Postgres treats NULL as distinct from NULL in a unique index, so the
  // DB-level @@unique([tenantId, branchId]) constraint does NOT actually
  // stop two tenant-wide-default rows (branchId null) from being created —
  // Prisma's own .upsert() relies on that constraint for its ON CONFLICT,
  // so it can't be trusted for the null case either. find-then-write by
  // hand instead, for both the null and non-null case, one code path.
  private findConfig(tenantId: string, branchId: string | null) {
    return this.prisma.client.deliveryProviderConfig.findFirst({ where: { tenantId, branchId } });
  }

  // The config actually in effect for a branch: its own override, else the
  // tenant-wide default, else null (= today's behavior, own-fleet/manual
  // with nothing auto-notified).
  async resolveForBranch(tenantId: string, branchId: string) {
    const branchConfig = await this.findConfig(tenantId, branchId);
    if (branchConfig?.enabled) return branchConfig;

    const tenantDefault = await this.findConfig(tenantId, null);
    return tenantDefault?.enabled ? tenantDefault : null;
  }

  async upsert(tenantId: string, dto: UpsertDeliveryProviderConfigDto) {
    if (dto.branchId) {
      const branch = await this.prisma.client.branch.findUnique({ where: { id: dto.branchId } });
      if (!branch) throw new ValidationError('branchId no corresponde a una sucursal de este negocio');
    }
    if (dto.type === 'TELEGRAM_NOTIFY' && !dto.chatId) {
      throw new ValidationError('chatId es obligatorio para notificar por Telegram');
    }

    const existing = await this.findConfig(tenantId, dto.branchId ?? null);
    if (dto.type === 'TELEGRAM_NOTIFY' && !dto.botToken && !existing?.botTokenEncrypted) {
      throw new ValidationError('botToken es obligatorio para notificar por Telegram');
    }

    const data = {
      type: dto.type,
      ...(dto.operationMode !== undefined && { operationMode: dto.operationMode }),
      ...(dto.chatId !== undefined && { config: { chatId: dto.chatId } }),
      ...(dto.botToken && { botTokenEncrypted: encryptSecret(dto.botToken) }),
      ...(dto.enabled !== undefined && { enabled: dto.enabled }),
    };

    const config = existing
      ? await this.prisma.client.deliveryProviderConfig.update({ where: { id: existing.id }, data })
      : await this.prisma.client.deliveryProviderConfig.create({
          data: { tenantId, branchId: dto.branchId, enabled: dto.enabled ?? true, ...data },
        });
    return serialize(config);
  }

  async delete(tenantId: string, branchId?: string) {
    const existing = await this.findConfig(tenantId, branchId ?? null);
    if (!existing) return { success: true };
    await this.prisma.client.deliveryProviderConfig.delete({ where: { id: existing.id } });
    return { success: true };
  }
}
