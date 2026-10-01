import { TemplatesService } from './templates.service';
import { NotFoundError, ValidationError } from '@omniflow/utils';

function jsonResponse(body: any, ok = true, status = 200) {
  return { ok, status, json: async () => body };
}

describe('TemplatesService', () => {
  let service: TemplatesService;
  let prisma: any;
  let tenantContext: any;
  let originalFetch: any;

  beforeEach(() => {
    prisma = {
      client: {
        messageTemplate: {
          findMany: jest.fn(),
          findUnique: jest.fn(),
          create: jest.fn(),
          update: jest.fn(),
          delete: jest.fn(),
        },
        metaConnection: { findUnique: jest.fn() },
      },
      raw: {
        messageTemplate: { findFirst: jest.fn() },
      },
    };
    tenantContext = { getTenantId: jest.fn().mockReturnValue('tenant-1') };
    service = new TemplatesService(prisma, tenantContext);
    originalFetch = global.fetch;
    global.fetch = jest.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe('findOne', () => {
    it('throws NotFoundError when missing', async () => {
      prisma.client.messageTemplate.findUnique.mockResolvedValue(null);
      await expect(service.findOne('missing')).rejects.toThrow(NotFoundError);
    });
  });

  describe('update', () => {
    it('rejects editing an already PENDING_APPROVAL template', async () => {
      prisma.client.messageTemplate.findUnique.mockResolvedValue({ id: 't1', status: 'PENDING_APPROVAL' });
      await expect(service.update('t1', { bodyText: 'x' })).rejects.toThrow(ValidationError);
    });

    it('allows editing a DRAFT template', async () => {
      prisma.client.messageTemplate.findUnique.mockResolvedValue({ id: 't1', status: 'DRAFT' });
      prisma.client.messageTemplate.update.mockResolvedValue({ id: 't1', bodyText: 'x' });
      await service.update('t1', { bodyText: 'x' });
      expect(prisma.client.messageTemplate.update).toHaveBeenCalledWith({ where: { id: 't1' }, data: { bodyText: 'x' } });
    });
  });

  describe('submit', () => {
    const draftTemplate = {
      id: 't1',
      status: 'DRAFT',
      name: 'order_confirmed',
      category: 'UTILITY',
      language: 'es',
      headerText: null,
      bodyText: 'Hola {{1}}, tu pedido {{2}} fue confirmado.',
      footerText: null,
    };

    it('rejects when WhatsApp is not connected', async () => {
      prisma.client.messageTemplate.findUnique.mockResolvedValue(draftTemplate);
      prisma.client.metaConnection.findUnique.mockResolvedValue(null);
      await expect(service.submit('t1')).rejects.toThrow(ValidationError);
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('rejects when the connection has no wabaId', async () => {
      prisma.client.messageTemplate.findUnique.mockResolvedValue(draftTemplate);
      prisma.client.metaConnection.findUnique.mockResolvedValue({ accessToken: 'tok', wabaId: null });
      await expect(service.submit('t1')).rejects.toThrow(ValidationError);
    });

    it('rejects a template that is already PENDING_APPROVAL/APPROVED', async () => {
      prisma.client.messageTemplate.findUnique.mockResolvedValue({ ...draftTemplate, status: 'APPROVED' });
      await expect(service.submit('t1')).rejects.toThrow(ValidationError);
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('submits BODY-only components and stores the externalTemplateId on success', async () => {
      prisma.client.messageTemplate.findUnique.mockResolvedValue(draftTemplate);
      prisma.client.metaConnection.findUnique.mockResolvedValue({ accessToken: 'tok', wabaId: 'waba-1' });
      (global.fetch as jest.Mock).mockResolvedValue(jsonResponse({ id: 'meta-tpl-1' }));
      prisma.client.messageTemplate.update.mockResolvedValue({ id: 't1', status: 'PENDING_APPROVAL' });

      await service.submit('t1');

      expect(global.fetch).toHaveBeenCalledWith(
        'https://graph.facebook.com/v19.0/waba-1/message_templates',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({ Authorization: 'Bearer tok' }),
        }),
      );
      const sentBody = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
      expect(sentBody.components).toEqual([{ type: 'BODY', text: draftTemplate.bodyText }]);
      expect(prisma.client.messageTemplate.update).toHaveBeenCalledWith({
        where: { id: 't1' },
        data: { status: 'PENDING_APPROVAL', externalTemplateId: 'meta-tpl-1', submittedAt: expect.any(Date), rejectionReason: null },
      });
    });

    it('includes HEADER/FOOTER components when present', async () => {
      prisma.client.messageTemplate.findUnique.mockResolvedValue({
        ...draftTemplate,
        headerText: 'Encabezado',
        footerText: 'Pie',
      });
      prisma.client.metaConnection.findUnique.mockResolvedValue({ accessToken: 'tok', wabaId: 'waba-1' });
      (global.fetch as jest.Mock).mockResolvedValue(jsonResponse({ id: 'meta-tpl-1' }));
      prisma.client.messageTemplate.update.mockResolvedValue({});

      await service.submit('t1');

      const sentBody = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
      expect(sentBody.components).toEqual([
        { type: 'HEADER', format: 'TEXT', text: 'Encabezado' },
        { type: 'BODY', text: draftTemplate.bodyText },
        { type: 'FOOTER', text: 'Pie' },
      ]);
    });

    it('surfaces Meta\'s real error message on failure without swallowing it', async () => {
      prisma.client.messageTemplate.findUnique.mockResolvedValue(draftTemplate);
      prisma.client.metaConnection.findUnique.mockResolvedValue({ accessToken: 'tok', wabaId: 'waba-1' });
      (global.fetch as jest.Mock).mockResolvedValue(
        jsonResponse({ error: { message: 'Invalid OAuth access token' } }, false, 401),
      );

      await expect(service.submit('t1')).rejects.toThrow('Invalid OAuth access token');
      expect(prisma.client.messageTemplate.update).not.toHaveBeenCalled();
    });
  });

  describe('syncStatus / applyStatusUpdate', () => {
    it('rejects a template that was never submitted', async () => {
      prisma.client.messageTemplate.findUnique.mockResolvedValue({ id: 't1', externalTemplateId: null });
      await expect(service.syncStatus('t1')).rejects.toThrow(ValidationError);
    });

    it('maps Meta APPROVED status and clears rejectionReason', async () => {
      prisma.client.messageTemplate.findUnique.mockResolvedValue({ id: 't1', externalTemplateId: 'meta-tpl-1' });
      prisma.client.metaConnection.findUnique.mockResolvedValue({ accessToken: 'tok' });
      (global.fetch as jest.Mock).mockResolvedValue(jsonResponse({ status: 'APPROVED' }));
      prisma.client.messageTemplate.update.mockResolvedValue({ id: 't1', status: 'APPROVED' });

      await service.syncStatus('t1');

      expect(prisma.client.messageTemplate.update).toHaveBeenCalledWith({
        where: { id: 't1' },
        data: { status: 'APPROVED', rejectionReason: null, reviewedAt: expect.any(Date) },
      });
    });

    it('maps Meta REJECTED status and stores the reason', async () => {
      prisma.client.messageTemplate.findUnique.mockResolvedValue({ id: 't1', externalTemplateId: 'meta-tpl-1' });
      prisma.client.metaConnection.findUnique.mockResolvedValue({ accessToken: 'tok' });
      (global.fetch as jest.Mock).mockResolvedValue(jsonResponse({ status: 'REJECTED', rejected_reason: 'INVALID_FORMAT' }));
      prisma.client.messageTemplate.update.mockResolvedValue({ id: 't1', status: 'REJECTED' });

      await service.syncStatus('t1');

      expect(prisma.client.messageTemplate.update).toHaveBeenCalledWith({
        where: { id: 't1' },
        data: { status: 'REJECTED', rejectionReason: 'INVALID_FORMAT', reviewedAt: expect.any(Date) },
      });
    });

    it('applyStatusUpdate is a no-op for an unrecognized Meta status', async () => {
      prisma.client.messageTemplate.findUnique.mockResolvedValue({ id: 't1', status: 'DRAFT' });
      await service.applyStatusUpdate('t1', 'IN_APPEAL');
      expect(prisma.client.messageTemplate.update).not.toHaveBeenCalled();
    });
  });
});
