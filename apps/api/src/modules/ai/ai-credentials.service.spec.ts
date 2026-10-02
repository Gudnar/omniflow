import { AiCredentialsService } from './ai-credentials.service';

const originalFetch = global.fetch;
const originalKey = process.env.SECRETS_ENCRYPTION_KEY;

describe('AiCredentialsService', () => {
  let service: AiCredentialsService;
  let prisma: any;

  beforeAll(() => {
    process.env.SECRETS_ENCRYPTION_KEY = '0'.repeat(64);
  });

  afterAll(() => {
    process.env.SECRETS_ENCRYPTION_KEY = originalKey;
    global.fetch = originalFetch;
  });

  beforeEach(() => {
    prisma = {
      client: {
        aiProvider: { findUnique: jest.fn() },
        tenantAiCredential: {
          findUnique: jest.fn(),
          upsert: jest.fn(),
          delete: jest.fn(),
        },
      },
    };
    service = new AiCredentialsService(prisma);
  });

  describe('upsert', () => {
    it('encrypts the api key before saving (never stores it in plaintext)', async () => {
      prisma.client.aiProvider.findUnique.mockResolvedValue({ id: 'p-openai', type: 'OPENAI' });
      prisma.client.tenantAiCredential.upsert.mockImplementation(({ create }: any) =>
        Promise.resolve({ id: 'cred-1', tenantId: 't1', providerId: 'p-openai', ...create }),
      );

      await service.upsert('t1', 'p-openai', 'sk-real-secret');

      const call = prisma.client.tenantAiCredential.upsert.mock.calls[0][0];
      expect(call.create.apiKeyEncrypted).not.toContain('sk-real-secret');
      expect(call.update.apiKeyEncrypted).not.toContain('sk-real-secret');
      expect(call.where).toEqual({ tenantId_providerId: { tenantId: 't1', providerId: 'p-openai' } });
    });

    it('throws NotFoundError when the provider does not exist', async () => {
      prisma.client.aiProvider.findUnique.mockResolvedValue(null);
      await expect(service.upsert('t1', 'missing', 'sk-x')).rejects.toThrow();
    });
  });

  describe('get / mask', () => {
    it('masks the decrypted key, showing only the first 4 characters', async () => {
      const { encryptSecret } = jest.requireActual('@omniflow/utils');
      prisma.client.tenantAiCredential.findUnique.mockResolvedValue({
        id: 'cred-1',
        tenantId: 't1',
        providerId: 'p-openai',
        apiKeyEncrypted: encryptSecret('sk-1234567890'),
      });

      const result = await service.get('t1', 'p-openai');

      expect(result.apiKey).toBe(`sk-1${'•'.repeat(16)}`);
      expect(result).not.toHaveProperty('apiKeyEncrypted');
    });

    it('throws NotFoundError when no credential exists for this tenant/provider', async () => {
      prisma.client.tenantAiCredential.findUnique.mockResolvedValue(null);
      await expect(service.get('t1', 'p-openai')).rejects.toThrow();
    });
  });

  describe('getDecrypted', () => {
    it('returns null when the tenant has no credential (no platform fallback)', async () => {
      prisma.client.tenantAiCredential.findUnique.mockResolvedValue(null);
      const result = await service.getDecrypted('t1', 'p-openai');
      expect(result).toBeNull();
    });

    it('round-trips: decrypts exactly what upsert encrypted', async () => {
      prisma.client.aiProvider.findUnique.mockResolvedValue({ id: 'p-openai', type: 'OPENAI' });
      let storedEncrypted = '';
      prisma.client.tenantAiCredential.upsert.mockImplementation(({ create }: any) => {
        storedEncrypted = create.apiKeyEncrypted;
        return Promise.resolve({ id: 'cred-1', tenantId: 't1', providerId: 'p-openai', apiKeyEncrypted: storedEncrypted });
      });
      await service.upsert('t1', 'p-openai', 'sk-round-trip');

      prisma.client.tenantAiCredential.findUnique.mockResolvedValue({ apiKeyEncrypted: storedEncrypted });
      const result = await service.getDecrypted('t1', 'p-openai');

      expect(result).toBe('sk-round-trip');
    });
  });

  describe('remove', () => {
    it('deletes the credential after confirming it exists', async () => {
      const { encryptSecret } = jest.requireActual('@omniflow/utils');
      prisma.client.tenantAiCredential.findUnique.mockResolvedValue({
        id: 'cred-1',
        tenantId: 't1',
        providerId: 'p-openai',
        apiKeyEncrypted: encryptSecret('sk-to-delete'),
      });

      const result = await service.remove('t1', 'p-openai');

      expect(prisma.client.tenantAiCredential.delete).toHaveBeenCalledWith({
        where: { tenantId_providerId: { tenantId: 't1', providerId: 'p-openai' } },
      });
      expect(result).toEqual({ success: true });
    });

    it('throws NotFoundError when nothing to remove', async () => {
      prisma.client.tenantAiCredential.findUnique.mockResolvedValue(null);
      await expect(service.remove('t1', 'p-openai')).rejects.toThrow();
    });
  });

  describe('testConnection', () => {
    it('reports ok:true when OpenAI accepts the key', async () => {
      prisma.client.aiProvider.findUnique.mockResolvedValue({ id: 'p-openai', type: 'OPENAI' });
      global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ data: [] }) }) as any;

      const result = await service.testConnection('t1', 'p-openai', 'sk-valid');

      expect(result.ok).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.openai.com/v1/models',
        expect.objectContaining({ headers: { Authorization: 'Bearer sk-valid' } }),
      );
    });

    it('reports ok:false without throwing when OpenAI rejects the key', async () => {
      prisma.client.aiProvider.findUnique.mockResolvedValue({ id: 'p-openai', type: 'OPENAI' });
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ error: { message: 'Invalid API key' } }),
      }) as any;

      const result = await service.testConnection('t1', 'p-openai', 'sk-invalid');

      expect(result).toEqual({ ok: false, message: 'Invalid API key' });
    });

    it('falls back to the already-saved key when none is supplied', async () => {
      prisma.client.aiProvider.findUnique.mockResolvedValue({ id: 'p-openai', type: 'OPENAI' });
      const { encryptSecret } = jest.requireActual('@omniflow/utils');
      prisma.client.tenantAiCredential.findUnique.mockResolvedValue({ apiKeyEncrypted: encryptSecret('sk-saved') });
      global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ data: [] }) }) as any;

      await service.testConnection('t1', 'p-openai');

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.openai.com/v1/models',
        expect.objectContaining({ headers: { Authorization: 'Bearer sk-saved' } }),
      );
    });

    it('throws ValidationError when there is no key to test at all', async () => {
      prisma.client.aiProvider.findUnique.mockResolvedValue({ id: 'p-openai', type: 'OPENAI' });
      prisma.client.tenantAiCredential.findUnique.mockResolvedValue(null);
      await expect(service.testConnection('t1', 'p-openai')).rejects.toThrow();
    });

    it('reports "not supported yet" for a provider without a real adapter, never a false ok:true', async () => {
      prisma.client.aiProvider.findUnique.mockResolvedValue({ id: 'p-anthropic', type: 'ANTHROPIC' });

      const result = await service.testConnection('t1', 'p-anthropic', 'sk-whatever');

      expect(result.ok).toBe(false);
    });
  });
});
