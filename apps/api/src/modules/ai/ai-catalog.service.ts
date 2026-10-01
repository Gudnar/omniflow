import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AiProviderType } from '@omniflow/database';

// A provider "connected" only when its API key env var is actually set —
// this is the single source of truth the Agent form's model picker and the
// Providers tab both read, so an unconfigured provider's models are never
// selectable (see listModels' filter below).
function isConfigured(type: AiProviderType): boolean {
  switch (type) {
    case 'OPENAI':
      return !!process.env.OPENAI_API_KEY;
    case 'ANTHROPIC':
      return !!process.env.ANTHROPIC_API_KEY;
    case 'GEMINI':
      return !!process.env.GOOGLE_API_KEY;
    default:
      return false;
  }
}

@Injectable()
export class AiCatalogService {
  constructor(private prisma: PrismaService) {}

  async listProviders() {
    const providers = await this.prisma.client.aiProvider.findMany({ orderBy: { type: 'asc' } });
    return providers.map((p: any) => ({ ...p, connected: isConfigured(p.type) }));
  }

  async listModels() {
    const models = await this.prisma.client.aiModel.findMany({
      where: { status: 'ACTIVE' },
      include: { provider: true },
      orderBy: { name: 'asc' },
    });
    return models.filter((m: any) => isConfigured(m.provider.type));
  }
}
