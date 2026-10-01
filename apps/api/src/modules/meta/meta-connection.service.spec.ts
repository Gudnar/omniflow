import { MetaConnectionService } from './meta-connection.service';
import { ConflictError, NotFoundError, ValidationError } from '@omniflow/utils';

describe('MetaConnectionService', () => {
  let service: MetaConnectionService;
  let prisma: any;

  const dto = {
    externalAccountId: '1234567890',
    accessToken: 'FAKE_TOKEN_abc123',
    displayName: '+59171234567',
    wabaId: '0987654321',
  };

  const originalFetch = global.fetch;

  beforeEach(() => {
    prisma = {
      client: {
        metaConnection: {
          upsert: jest.fn(),
          findUnique: jest.fn(),
          update: jest.fn(),
        },
      },
    };
    service = new MetaConnectionService(prisma);
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe.each(['WHATSAPP', 'INSTAGRAM', 'MESSENGER', 'FACEBOOK'] as const)('for channel %s', (channel) => {
    describe('connect', () => {
      it('upserts by the tenantId+channel composite key and forces CONNECTED', async () => {
        prisma.client.metaConnection.upsert.mockResolvedValue({ tenantId: 't1', channel, ...dto });
        await service.connect('t1', channel, dto);
        const callArgs = prisma.client.metaConnection.upsert.mock.calls[0][0];
        expect(callArgs.where).toEqual({ tenantId_channel: { tenantId: 't1', channel } });
        expect(callArgs.update.status).toBe('CONNECTED');
        expect(callArgs.create.tenantId).toBe('t1');
        expect(callArgs.create.channel).toBe(channel);
      });

      it('only sets wabaId for WHATSAPP', async () => {
        prisma.client.metaConnection.upsert.mockResolvedValue({ tenantId: 't1', channel, ...dto });
        await service.connect('t1', channel, dto);
        const callArgs = prisma.client.metaConnection.upsert.mock.calls[0][0];
        if (channel === 'WHATSAPP') {
          expect(callArgs.create.wabaId).toBe('0987654321');
        } else {
          expect(callArgs.create.wabaId).toBeUndefined();
        }
      });

      it('masks the access token in the returned connection', async () => {
        prisma.client.metaConnection.upsert.mockResolvedValue({ tenantId: 't1', channel, ...dto });
        const result = await service.connect('t1', channel, dto);
        expect(result.accessToken).not.toBe(dto.accessToken);
        expect(result.accessToken).toMatch(/^FAKE/);
      });

      it('maps a P2002 on externalAccountId to ConflictError', async () => {
        prisma.client.metaConnection.upsert.mockRejectedValue({
          code: 'P2002',
          meta: { target: ['channel', 'externalAccountId'] },
        });
        await expect(service.connect('t1', channel, dto)).rejects.toThrow(ConflictError);
      });

      it('rejects a first-time connect with no accessToken and no prior connection', async () => {
        prisma.client.metaConnection.findUnique.mockResolvedValue(null);
        const { accessToken, ...dtoWithoutToken } = dto;
        await expect(service.connect('t1', channel, dtoWithoutToken as any)).rejects.toThrow(ValidationError);
        expect(prisma.client.metaConnection.upsert).not.toHaveBeenCalled();
      });

      it('keeps the existing accessToken when editing without re-pasting it', async () => {
        prisma.client.metaConnection.findUnique.mockResolvedValue({ tenantId: 't1', channel, ...dto });
        prisma.client.metaConnection.upsert.mockResolvedValue({ tenantId: 't1', channel, ...dto, displayName: 'Nuevo nombre' });

        const { accessToken, ...dtoWithoutToken } = dto;
        await service.connect('t1', channel, { ...dtoWithoutToken, displayName: 'Nuevo nombre' } as any);

        const callArgs = prisma.client.metaConnection.upsert.mock.calls[0][0];
        expect(callArgs.update.accessToken).toBe(dto.accessToken);
        expect(callArgs.update.displayName).toBe('Nuevo nombre');
      });
    });

    describe('get', () => {
      it('throws NotFoundError when no connection exists', async () => {
        prisma.client.metaConnection.findUnique.mockResolvedValue(null);
        await expect(service.get('t1', channel)).rejects.toThrow(NotFoundError);
      });

      it('masks the access token', async () => {
        prisma.client.metaConnection.findUnique.mockResolvedValue({ tenantId: 't1', channel, ...dto });
        const result = await service.get('t1', channel);
        expect(result.accessToken).not.toBe(dto.accessToken);
      });
    });

    describe('disconnect', () => {
      it('flips status to DISCONNECTED via the composite key', async () => {
        prisma.client.metaConnection.findUnique.mockResolvedValue({ tenantId: 't1', channel, ...dto });
        prisma.client.metaConnection.update.mockResolvedValue({
          tenantId: 't1',
          channel,
          ...dto,
          status: 'DISCONNECTED',
        });

        await service.disconnect('t1', channel);

        expect(prisma.client.metaConnection.update).toHaveBeenCalledWith({
          where: { tenantId_channel: { tenantId: 't1', channel } },
          data: { status: 'DISCONNECTED' },
        });
      });
    });

    describe('testConnection', () => {
      it('rejects when there is no accessToken to test, without calling fetch', async () => {
        prisma.client.metaConnection.findUnique.mockResolvedValue(null);
        global.fetch = jest.fn();
        const { accessToken, ...dtoWithoutToken } = dto;
        await expect(service.testConnection('t1', channel, dtoWithoutToken as any)).rejects.toThrow(ValidationError);
        expect(global.fetch).not.toHaveBeenCalled();
      });

      it('falls back to the already-stored token when the dto omits one', async () => {
        prisma.client.metaConnection.findUnique.mockResolvedValue({ tenantId: 't1', channel, ...dto, accessToken: 'STORED_TOKEN' });
        global.fetch = jest.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ name: 'Mi Página' }) }) as any;

        const { accessToken, ...dtoWithoutToken } = dto;
        await service.testConnection('t1', channel, dtoWithoutToken as any);

        const [, init] = (global.fetch as jest.Mock).mock.calls[0];
        expect(init.headers.Authorization).toBe('Bearer STORED_TOKEN');
      });

      it('returns ok:false with the provider error message when Graph API rejects the token, without throwing', async () => {
        prisma.client.metaConnection.findUnique.mockResolvedValue(null);
        global.fetch = jest.fn().mockResolvedValue({
          ok: false,
          status: 401,
          json: () => Promise.resolve({ error: { message: 'Invalid OAuth access token' } }),
        }) as any;

        const result = await service.testConnection('t1', channel, dto);

        expect(result).toEqual({ ok: false, message: 'Invalid OAuth access token' });
      });

      it('returns ok:false when the request itself fails (network error), without throwing', async () => {
        prisma.client.metaConnection.findUnique.mockResolvedValue(null);
        global.fetch = jest.fn().mockRejectedValue(new Error('fetch failed')) as any;

        const result = await service.testConnection('t1', channel, dto);

        expect(result.ok).toBe(false);
        expect(result.message).toContain('fetch failed');
      });
    });
  });

  describe('testConnection success messages per channel', () => {
    it('describes a WhatsApp success with the verified name and phone number', async () => {
      prisma.client.metaConnection.findUnique.mockResolvedValue(null);
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ verified_name: 'Mi Negocio', display_phone_number: '+591 700 12345' }),
      }) as any;

      const result = await service.testConnection('t1', 'WHATSAPP', dto);

      expect(result).toEqual({ ok: true, message: 'Conectado como Mi Negocio (+591 700 12345)' });
    });

    it('describes an Instagram success with the @username', async () => {
      prisma.client.metaConnection.findUnique.mockResolvedValue(null);
      global.fetch = jest.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ username: 'mi_tienda' }) }) as any;

      const result = await service.testConnection('t1', 'INSTAGRAM', dto);

      expect(result).toEqual({ ok: true, message: 'Conectado como @mi_tienda' });
    });

    it('describes a Messenger/Facebook success with the Page name', async () => {
      prisma.client.metaConnection.findUnique.mockResolvedValue(null);
      global.fetch = jest.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ name: 'Mi Página' }) }) as any;

      const result = await service.testConnection('t1', 'MESSENGER', dto);

      expect(result).toEqual({ ok: true, message: 'Conectado como Mi Página' });
    });
  });
});
