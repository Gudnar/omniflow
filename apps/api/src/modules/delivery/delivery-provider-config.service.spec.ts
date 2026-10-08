import { DeliveryProviderConfigService } from './delivery-provider-config.service';
import { ValidationError } from '@omniflow/utils';

jest.mock('@omniflow/utils', () => ({
  ...jest.requireActual('@omniflow/utils'),
  encryptSecret: jest.fn((s: string) => `enc:${s}`),
}));

describe('DeliveryProviderConfigService', () => {
  let service: DeliveryProviderConfigService;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      client: {
        deliveryProviderConfig: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn(), findMany: jest.fn(), delete: jest.fn() },
        branch: { findUnique: jest.fn() },
      },
    };
    service = new DeliveryProviderConfigService(prisma);
  });

  describe('resolveForBranch', () => {
    it('returns the branch override when enabled', async () => {
      prisma.client.deliveryProviderConfig.findFirst.mockResolvedValueOnce({ id: 'c1', enabled: true, type: 'TELEGRAM_NOTIFY' });
      const result = await service.resolveForBranch('t1', 'b1');
      expect(result?.id).toBe('c1');
    });

    it('falls back to the tenant-wide default when there is no branch override', async () => {
      prisma.client.deliveryProviderConfig.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: 'default', enabled: true, type: 'TELEGRAM_NOTIFY' });
      const result = await service.resolveForBranch('t1', 'b1');
      expect(result?.id).toBe('default');
      // Looks up the null-branchId row by findFirst, never findUnique — a
      // Postgres unique index treats NULL as distinct from NULL, so
      // findUnique/upsert on that compound key can't be trusted here.
      expect(prisma.client.deliveryProviderConfig.findFirst).toHaveBeenNthCalledWith(2, {
        where: { tenantId: 't1', branchId: null },
      });
    });

    it('returns null when nothing is configured', async () => {
      prisma.client.deliveryProviderConfig.findFirst.mockResolvedValue(null);
      const result = await service.resolveForBranch('t1', 'b1');
      expect(result).toBeNull();
    });
  });

  describe('upsert', () => {
    it('rejects TELEGRAM_NOTIFY with no chatId', async () => {
      await expect(service.upsert('t1', { type: 'TELEGRAM_NOTIFY' } as any)).rejects.toThrow(ValidationError);
    });

    it('rejects TELEGRAM_NOTIFY with no botToken on first creation', async () => {
      prisma.client.deliveryProviderConfig.findFirst.mockResolvedValue(null);
      await expect(
        service.upsert('t1', { type: 'TELEGRAM_NOTIFY', chatId: '123' } as any),
      ).rejects.toThrow(ValidationError);
    });

    it('creates with an encrypted bot token and never leaks it back', async () => {
      prisma.client.deliveryProviderConfig.findFirst.mockResolvedValue(null);
      prisma.client.deliveryProviderConfig.create.mockResolvedValue({
        id: 'c1',
        type: 'TELEGRAM_NOTIFY',
        botTokenEncrypted: 'enc:secret',
        config: { chatId: '123' },
      });
      const result = await service.upsert('t1', { type: 'TELEGRAM_NOTIFY', chatId: '123', botToken: 'secret' } as any);
      expect(prisma.client.deliveryProviderConfig.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ botTokenEncrypted: 'enc:secret' }) }),
      );
      expect(result).not.toHaveProperty('botTokenEncrypted');
      expect(result.hasBotToken).toBe(true);
    });

    it('keeps the existing bot token on update when botToken is omitted', async () => {
      prisma.client.deliveryProviderConfig.findFirst.mockResolvedValue({
        id: 'c1',
        botTokenEncrypted: 'enc:old',
      });
      prisma.client.deliveryProviderConfig.update.mockResolvedValue({ id: 'c1', botTokenEncrypted: 'enc:old' });
      await service.upsert('t1', { type: 'TELEGRAM_NOTIFY', chatId: '123' } as any);
      expect(prisma.client.deliveryProviderConfig.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.not.objectContaining({ botTokenEncrypted: expect.anything() }) }),
      );
    });
  });
});
