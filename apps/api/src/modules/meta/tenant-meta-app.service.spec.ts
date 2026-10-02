import { TenantMetaAppService } from './tenant-meta-app.service';
import { NotFoundError, ValidationError } from '@omniflow/utils';

const originalKey = process.env.SECRETS_ENCRYPTION_KEY;
const originalPublicUrl = process.env.API_PUBLIC_URL;

describe('TenantMetaAppService', () => {
  let service: TenantMetaAppService;
  let prisma: any;

  beforeAll(() => {
    process.env.SECRETS_ENCRYPTION_KEY = '0'.repeat(64);
    process.env.API_PUBLIC_URL = 'https://api.tu-dominio.com';
  });

  afterAll(() => {
    process.env.SECRETS_ENCRYPTION_KEY = originalKey;
    process.env.API_PUBLIC_URL = originalPublicUrl;
  });

  beforeEach(() => {
    prisma = {
      client: {
        tenantMetaAppCredential: {
          findUnique: jest.fn(),
          upsert: jest.fn(),
          delete: jest.fn(),
        },
      },
    };
    service = new TenantMetaAppService(prisma);
  });

  describe('connect', () => {
    it('generates webhookPathId and webhookVerifyToken on first connect', async () => {
      prisma.client.tenantMetaAppCredential.findUnique.mockResolvedValue(null);
      prisma.client.tenantMetaAppCredential.upsert.mockImplementation(({ create }: any) => Promise.resolve(create));

      const result = await service.connect('t1', { appId: 'app-1', appSecret: 'super-secret' });

      const call = prisma.client.tenantMetaAppCredential.upsert.mock.calls[0][0];
      expect(call.create.webhookPathId).toHaveLength(32);
      expect(call.create.webhookVerifyToken).toHaveLength(48);
      expect(call.create.appSecretEncrypted).not.toContain('super-secret');
      expect(result.webhookUrl).toBe(`https://api.tu-dominio.com/webhooks/meta/c/${call.create.webhookPathId}`);
      expect(result.webhookVerifyToken).toBe(call.create.webhookVerifyToken);
      expect(result).not.toHaveProperty('appSecret');
      expect(result).not.toHaveProperty('appSecretEncrypted');
    });

    it('throws ValidationError when connecting for the first time without an appSecret', async () => {
      prisma.client.tenantMetaAppCredential.findUnique.mockResolvedValue(null);
      await expect(service.connect('t1', { appId: 'app-1' } as any)).rejects.toThrow(ValidationError);
    });

    it('keeps the existing webhookPathId/webhookVerifyToken on a later edit, never regenerating them', async () => {
      prisma.client.tenantMetaAppCredential.findUnique.mockResolvedValue({
        tenantId: 't1',
        appId: 'app-1',
        appSecretEncrypted: 'old-encrypted',
        webhookPathId: 'existing-path-id',
        webhookVerifyToken: 'existing-verify-token',
      });
      prisma.client.tenantMetaAppCredential.upsert.mockImplementation(({ update }: any) =>
        Promise.resolve({
          tenantId: 't1',
          appId: update.appId,
          webhookPathId: 'existing-path-id',
          webhookVerifyToken: 'existing-verify-token',
        }),
      );

      const result = await service.connect('t1', { appId: 'app-1-renamed' });

      const call = prisma.client.tenantMetaAppCredential.upsert.mock.calls[0][0];
      expect(call.update).not.toHaveProperty('appSecretEncrypted');
      expect(result.webhookUrl).toContain('existing-path-id');
      expect(result.webhookVerifyToken).toBe('existing-verify-token');
    });

    it('re-encrypts the secret on an edit only when a new one is supplied', async () => {
      prisma.client.tenantMetaAppCredential.findUnique.mockResolvedValue({
        tenantId: 't1',
        appId: 'app-1',
        appSecretEncrypted: 'old-encrypted',
        webhookPathId: 'existing-path-id',
        webhookVerifyToken: 'existing-verify-token',
      });
      prisma.client.tenantMetaAppCredential.upsert.mockResolvedValue({
        tenantId: 't1',
        appId: 'app-1',
        webhookPathId: 'existing-path-id',
        webhookVerifyToken: 'existing-verify-token',
      });

      await service.connect('t1', { appId: 'app-1', appSecret: 'new-secret' });

      const call = prisma.client.tenantMetaAppCredential.upsert.mock.calls[0][0];
      expect(call.update.appSecretEncrypted).toBeDefined();
      expect(call.update.appSecretEncrypted).not.toContain('new-secret');
    });
  });

  describe('get', () => {
    it('never returns the secret, masked or otherwise', async () => {
      prisma.client.tenantMetaAppCredential.findUnique.mockResolvedValue({
        tenantId: 't1',
        appId: 'app-1',
        appSecretEncrypted: 'whatever',
        webhookPathId: 'path-id',
        webhookVerifyToken: 'verify-token',
      });

      const result = await service.get('t1');

      expect(result).toEqual({
        appId: 'app-1',
        webhookUrl: 'https://api.tu-dominio.com/webhooks/meta/c/path-id',
        webhookVerifyToken: 'verify-token',
      });
    });

    it('throws NotFoundError when this tenant has no Meta App configured', async () => {
      prisma.client.tenantMetaAppCredential.findUnique.mockResolvedValue(null);
      await expect(service.get('t1')).rejects.toThrow(NotFoundError);
    });
  });

  describe('disconnect', () => {
    it('deletes the credential after confirming it exists', async () => {
      prisma.client.tenantMetaAppCredential.findUnique.mockResolvedValue({
        tenantId: 't1',
        appId: 'app-1',
        webhookPathId: 'path-id',
        webhookVerifyToken: 'verify-token',
      });

      const result = await service.disconnect('t1');

      expect(prisma.client.tenantMetaAppCredential.delete).toHaveBeenCalledWith({ where: { tenantId: 't1' } });
      expect(result).toEqual({ success: true });
    });
  });

  describe('findByWebhookPathId', () => {
    it('looks up the raw credential row by webhookPathId, for webhook verification', async () => {
      prisma.client.tenantMetaAppCredential.findUnique.mockResolvedValue({ tenantId: 't1', webhookPathId: 'path-id' });
      const result = await service.findByWebhookPathId('path-id');
      expect(prisma.client.tenantMetaAppCredential.findUnique).toHaveBeenCalledWith({ where: { webhookPathId: 'path-id' } });
      expect(result).toEqual({ tenantId: 't1', webhookPathId: 'path-id' });
    });
  });
});
