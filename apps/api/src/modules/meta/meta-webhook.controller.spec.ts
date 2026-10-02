import { createHmac } from 'crypto';
import { MetaWebhookController } from './meta-webhook.controller';

function mockRes() {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.type = jest.fn().mockReturnValue(res);
  res.send = jest.fn().mockReturnValue(res);
  return res;
}

describe('MetaWebhookController — tenant routes (/c/:webhookPathId)', () => {
  let controller: MetaWebhookController;
  let webhookService: any;
  let tenantMetaAppService: any;

  beforeEach(() => {
    webhookService = { handlePayload: jest.fn().mockResolvedValue(undefined) };
    tenantMetaAppService = { findByWebhookPathId: jest.fn() };
    controller = new MetaWebhookController(webhookService, tenantMetaAppService);
  });

  describe('verifyTenant (GET)', () => {
    it('responds 404 when no credential matches the webhookPathId', async () => {
      tenantMetaAppService.findByWebhookPathId.mockResolvedValue(null);
      const res = mockRes();

      await controller.verifyTenant('unknown-id', { query: {} } as any, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('rejects with 403 when the verify_token does not match this tenant\'s own token', async () => {
      tenantMetaAppService.findByWebhookPathId.mockResolvedValue({ webhookVerifyToken: 'correct-token' });
      const res = mockRes();
      const req = { query: { 'hub.mode': 'subscribe', 'hub.verify_token': 'wrong-token', 'hub.challenge': 'xyz' } };

      await controller.verifyTenant('path-id', req as any, res);

      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('echoes the challenge with 200 when mode=subscribe and the token matches', async () => {
      tenantMetaAppService.findByWebhookPathId.mockResolvedValue({ webhookVerifyToken: 'correct-token' });
      const res = mockRes();
      const req = { query: { 'hub.mode': 'subscribe', 'hub.verify_token': 'correct-token', 'hub.challenge': 'xyz' } };

      await controller.verifyTenant('path-id', req as any, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith('xyz');
    });
  });

  describe('receiveTenant (POST)', () => {
    const rawBody = Buffer.from(JSON.stringify({ object: 'whatsapp_business_account', entry: [] }));

    function signatureFor(secret: string) {
      return `sha256=${createHmac('sha256', secret).update(rawBody).digest('hex')}`;
    }

    it('responds 404 when no credential matches the webhookPathId', async () => {
      tenantMetaAppService.findByWebhookPathId.mockResolvedValue(null);
      const res = mockRes();

      await controller.receiveTenant('unknown-id', { rawBody, body: {} } as any, undefined, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(webhookService.handlePayload).not.toHaveBeenCalled();
    });

    it('rejects with 401 when the signature does not match this tenant\'s own App Secret, even with a valid webhookPathId', async () => {
      process.env.SECRETS_ENCRYPTION_KEY = '0'.repeat(64);
      const { encryptSecret } = jest.requireActual('@omniflow/utils');
      tenantMetaAppService.findByWebhookPathId.mockResolvedValue({
        appSecretEncrypted: encryptSecret('tenant-own-secret'),
      });
      const res = mockRes();
      const wrongSignature = signatureFor('a-different-secret');

      await controller.receiveTenant('path-id', { rawBody, body: {} } as any, wrongSignature, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(webhookService.handlePayload).not.toHaveBeenCalled();
    });

    it('accepts and delegates unchanged to webhookService.handlePayload when the signature matches', async () => {
      process.env.SECRETS_ENCRYPTION_KEY = '0'.repeat(64);
      const { encryptSecret } = jest.requireActual('@omniflow/utils');
      tenantMetaAppService.findByWebhookPathId.mockResolvedValue({
        appSecretEncrypted: encryptSecret('tenant-own-secret'),
      });
      const res = mockRes();
      const correctSignature = signatureFor('tenant-own-secret');
      const body = { object: 'whatsapp_business_account', entry: [{ id: 'waba-1' }] };

      await controller.receiveTenant('path-id', { rawBody, body } as any, correctSignature, res);

      expect(webhookService.handlePayload).toHaveBeenCalledWith(body);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith('EVENT_RECEIVED');
    });

    it('still responds 200 (never leaks internal failure to Meta) even if handlePayload throws', async () => {
      process.env.SECRETS_ENCRYPTION_KEY = '0'.repeat(64);
      const { encryptSecret } = jest.requireActual('@omniflow/utils');
      tenantMetaAppService.findByWebhookPathId.mockResolvedValue({
        appSecretEncrypted: encryptSecret('tenant-own-secret'),
      });
      webhookService.handlePayload.mockRejectedValue(new Error('boom'));
      const res = mockRes();
      const correctSignature = signatureFor('tenant-own-secret');

      await controller.receiveTenant('path-id', { rawBody, body: {} } as any, correctSignature, res);

      expect(res.status).toHaveBeenCalledWith(200);
    });
  });
});
