import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AiCatalogService {
  constructor(private prisma: PrismaService) {}

  // A provider "connected" only when THIS tenant has configured their own
  // credential for it (TenantAiCredential) — this is the single source of
  // truth the Agent form's model picker and the Providers tab both read, so
  // an unconfigured provider's models are never selectable for this tenant
  // (see listModels' filter below). No platform-wide fallback key: a tenant
  // with no credential simply sees the provider as not configured.
  async listProviders(tenantId: string) {
    const [providers, credentials] = await Promise.all([
      this.prisma.client.aiProvider.findMany({ orderBy: { type: 'asc' } }),
      this.prisma.client.tenantAiCredential.findMany({ where: { tenantId }, select: { providerId: true } }),
    ]);
    const connectedIds = new Set(credentials.map((c: any) => c.providerId));
    return providers.map((p: any) => ({ ...p, connected: connectedIds.has(p.id) }));
  }

  async listModels(tenantId: string) {
    const [models, credentials] = await Promise.all([
      this.prisma.client.aiModel.findMany({
        where: { status: 'ACTIVE' },
        include: { provider: true },
        orderBy: { name: 'asc' },
      }),
      this.prisma.client.tenantAiCredential.findMany({ where: { tenantId }, select: { providerId: true } }),
    ]);
    const connectedIds = new Set(credentials.map((c: any) => c.providerId));
    return models.filter((m: any) => connectedIds.has(m.providerId));
  }
}
