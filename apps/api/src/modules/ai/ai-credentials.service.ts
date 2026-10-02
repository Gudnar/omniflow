import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundError, ValidationError } from '@omniflow/utils';
import { encryptSecret, decryptSecret } from '@omniflow/utils';
import { AiProviderType } from '@omniflow/database';

// Real reachability probes per provider — only OPENAI has a working adapter
// in this phase (see OpenAiAdapter's own doc comment), so every other
// provider type intentionally reports "not supported yet" rather than a
// false-positive "ok: true" nothing ever actually verified.
async function probe(type: AiProviderType, apiKey: string): Promise<{ ok: boolean; message: string }> {
  if (type !== 'OPENAI') {
    return { ok: false, message: 'La prueba de conexión aún no está disponible para este proveedor' };
  }
  try {
    const response = await fetch('https://api.openai.com/v1/models', {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!response.ok) {
      const body: any = await response.json().catch(() => ({}));
      return { ok: false, message: body?.error?.message ?? `OpenAI respondió con un error (${response.status})` };
    }
    return { ok: true, message: 'Conexión exitosa con OpenAI' };
  } catch (error: any) {
    return { ok: false, message: `No se pudo contactar a OpenAI: ${error.message}` };
  }
}

@Injectable()
export class AiCredentialsService {
  constructor(private prisma: PrismaService) {}

  private async findProvider(providerId: string) {
    const provider = await this.prisma.client.aiProvider.findUnique({ where: { id: providerId } });
    if (!provider) throw new NotFoundError('AiProvider');
    return provider;
  }

  // Same "edit without re-pasting the secret" resolution as
  // MetaConnectionService.testConnection — falls back to the stored key when
  // none is supplied, so an operator can re-verify an already-configured
  // provider with a single click.
  async testConnection(tenantId: string, providerId: string, apiKey?: string) {
    const provider = await this.findProvider(providerId);
    let key = apiKey;
    if (!key) {
      const existing = await this.prisma.client.tenantAiCredential.findUnique({
        where: { tenantId_providerId: { tenantId, providerId } },
      });
      key = existing ? decryptSecret(existing.apiKeyEncrypted) : undefined;
    }
    if (!key) throw new ValidationError('apiKey is required to test this connection');
    return probe(provider.type, key);
  }

  async upsert(tenantId: string, providerId: string, apiKey: string) {
    await this.findProvider(providerId);
    const credential = await this.prisma.client.tenantAiCredential.upsert({
      where: { tenantId_providerId: { tenantId, providerId } },
      update: { apiKeyEncrypted: encryptSecret(apiKey) },
      create: { tenantId, providerId, apiKeyEncrypted: encryptSecret(apiKey) },
    });
    return this.mask(credential);
  }

  async get(tenantId: string, providerId: string) {
    const credential = await this.prisma.client.tenantAiCredential.findUnique({
      where: { tenantId_providerId: { tenantId, providerId } },
    });
    if (!credential) throw new NotFoundError('TenantAiCredential');
    return this.mask(credential);
  }

  async remove(tenantId: string, providerId: string) {
    await this.get(tenantId, providerId);
    await this.prisma.client.tenantAiCredential.delete({
      where: { tenantId_providerId: { tenantId, providerId } },
    });
    return { success: true };
  }

  // Internal-only: resolves and decrypts the raw key for actual use against
  // the provider's API (AiReplyService). Never exposed over HTTP — callers
  // that face the client always go through get()/mask() instead.
  async getDecrypted(tenantId: string, providerId: string): Promise<string | null> {
    const credential = await this.prisma.client.tenantAiCredential.findUnique({
      where: { tenantId_providerId: { tenantId, providerId } },
    });
    if (!credential) return null;
    return decryptSecret(credential.apiKeyEncrypted);
  }

  private mask(credential: any) {
    const { apiKeyEncrypted, ...rest } = credential;
    const plain = decryptSecret(apiKeyEncrypted);
    return {
      ...rest,
      apiKey: `${plain.slice(0, 4)}${'•'.repeat(16)}`,
    };
  }
}
