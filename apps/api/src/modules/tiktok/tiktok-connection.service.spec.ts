import { TikTokConnectionService } from './tiktok-connection.service';
import { ConflictError, NotFoundError, ValidationError } from '@omniflow/utils';

describe('TikTokConnectionService', () => {
  let service: TikTokConnectionService;
  let prisma: any;

  const dto = {
    businessId: 'biz_1234567890',
    clientKey: 'ck_test',
    accessToken: 'FAKE_ACCESS_TOKEN',
    refreshToken: 'FAKE_REFRESH_TOKEN',
  };

  const originalFetch = global.fetch;

  beforeEach(() => {
    prisma = {
      client: {
        tikTokConnection: {
          upsert: jest.fn(),
          findUnique: jest.fn(),
          update: jest.fn(),
        },
      },
    };
    service = new TikTokConnectionService(prisma);
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe('connect', () => {
    it('upserts by tenantId and forces CONNECTED', async () => {
      prisma.client.tikTokConnection.upsert.mockResolvedValue({ tenantId: 't1', ...dto });
      await service.connect('t1', dto);
      const callArgs = prisma.client.tikTokConnection.upsert.mock.calls[0][0];
      expect(callArgs.where).toEqual({ tenantId: 't1' });
      expect(callArgs.update.status).toBe('CONNECTED');
      expect(callArgs.create.tenantId).toBe('t1');
    });

    it('masks both accessToken and refreshToken in the returned connection', async () => {
      prisma.client.tikTokConnection.upsert.mockResolvedValue({ tenantId: 't1', ...dto });
      const result = await service.connect('t1', dto);
      expect(result.accessToken).not.toBe(dto.accessToken);
      expect(result.refreshToken).not.toBe(dto.refreshToken);
      expect(result.accessToken).toMatch(/^FAKE/);
      expect(result.refreshToken).toMatch(/^FAKE/);
    });

    it('maps a P2002 on businessId to ConflictError', async () => {
      prisma.client.tikTokConnection.upsert.mockRejectedValue({
        code: 'P2002',
        meta: { target: ['businessId'] },
      });
      await expect(service.connect('t1', dto)).rejects.toThrow(ConflictError);
    });

    it('rejects a first-time connect with no tokens and no prior connection', async () => {
      prisma.client.tikTokConnection.findUnique.mockResolvedValue(null);
      const { accessToken, refreshToken, ...dtoWithoutTokens } = dto;
      await expect(service.connect('t1', dtoWithoutTokens as any)).rejects.toThrow(ValidationError);
      expect(prisma.client.tikTokConnection.upsert).not.toHaveBeenCalled();
    });

    it('keeps the existing tokens when editing without re-pasting them', async () => {
      prisma.client.tikTokConnection.findUnique.mockResolvedValue({ tenantId: 't1', ...dto });
      prisma.client.tikTokConnection.upsert.mockResolvedValue({ tenantId: 't1', ...dto, clientKey: 'ck_new' });

      const { accessToken, refreshToken, ...dtoWithoutTokens } = dto;
      await service.connect('t1', { ...dtoWithoutTokens, clientKey: 'ck_new' } as any);

      const callArgs = prisma.client.tikTokConnection.upsert.mock.calls[0][0];
      expect(callArgs.update.accessToken).toBe(dto.accessToken);
      expect(callArgs.update.refreshToken).toBe(dto.refreshToken);
      expect(callArgs.update.clientKey).toBe('ck_new');
    });
  });

  describe('get', () => {
    it('throws NotFoundError when no connection exists', async () => {
      prisma.client.tikTokConnection.findUnique.mockResolvedValue(null);
      await expect(service.get('t1')).rejects.toThrow(NotFoundError);
    });

    it('masks both tokens', async () => {
      prisma.client.tikTokConnection.findUnique.mockResolvedValue({ tenantId: 't1', ...dto });
      const result = await service.get('t1');
      expect(result.accessToken).not.toBe(dto.accessToken);
      expect(result.refreshToken).not.toBe(dto.refreshToken);
    });
  });

  describe('disconnect', () => {
    it('flips status to DISCONNECTED', async () => {
      prisma.client.tikTokConnection.findUnique.mockResolvedValue({ tenantId: 't1', ...dto });
      prisma.client.tikTokConnection.update.mockResolvedValue({ tenantId: 't1', ...dto, status: 'DISCONNECTED' });

      await service.disconnect('t1');

      expect(prisma.client.tikTokConnection.update).toHaveBeenCalledWith({
        where: { tenantId: 't1' },
        data: { status: 'DISCONNECTED' },
      });
    });
  });

  describe('testConnection', () => {
    it('rejects when there is no accessToken to test, without calling fetch', async () => {
      prisma.client.tikTokConnection.findUnique.mockResolvedValue(null);
      global.fetch = jest.fn();
      const { accessToken, ...dtoWithoutToken } = dto;
      await expect(service.testConnection('t1', dtoWithoutToken as any)).rejects.toThrow(ValidationError);
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('falls back to the already-stored token when the dto omits one', async () => {
      prisma.client.tikTokConnection.findUnique.mockResolvedValue({ tenantId: 't1', ...dto, accessToken: 'STORED_TOKEN' });
      global.fetch = jest.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({}) }) as any;

      const { accessToken, ...dtoWithoutToken } = dto;
      await service.testConnection('t1', dtoWithoutToken as any);

      const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
      expect(url).toBe(`https://business-api.tiktok.com/open_api/v1.3/business/get/?business_id=${dto.businessId}`);
      expect(init.headers['Access-Token']).toBe('STORED_TOKEN');
    });

    it('returns ok:true on a successful probe', async () => {
      prisma.client.tikTokConnection.findUnique.mockResolvedValue(null);
      global.fetch = jest.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({}) }) as any;

      const result = await service.testConnection('t1', dto);

      expect(result).toEqual({ ok: true, message: 'Token válido para TikTok Business' });
    });

    it('returns ok:false with the provider error message when TikTok rejects the token, without throwing', async () => {
      prisma.client.tikTokConnection.findUnique.mockResolvedValue(null);
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ message: 'Invalid access token' }),
      }) as any;

      const result = await service.testConnection('t1', dto);

      expect(result).toEqual({ ok: false, message: 'Invalid access token' });
    });

    it('returns ok:false when the request itself fails (network error), without throwing', async () => {
      prisma.client.tikTokConnection.findUnique.mockResolvedValue(null);
      global.fetch = jest.fn().mockRejectedValue(new Error('fetch failed')) as any;

      const result = await service.testConnection('t1', dto);

      expect(result.ok).toBe(false);
      expect(result.message).toContain('fetch failed');
    });
  });
});
