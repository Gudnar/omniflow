import { WebchatService } from './webchat.service';
import { NotFoundError, ValidationError } from '@omniflow/utils';

describe('WebchatService', () => {
  let service: WebchatService;
  let prisma: any;
  let tenantContext: any;
  let contactsService: any;
  let conversationsService: any;
  let messagesService: any;

  beforeEach(() => {
    prisma = {
      raw: {
        linkPage: { findUnique: jest.fn() },
        ecommerceStore: { findUnique: jest.fn() },
        conversation: { findUnique: jest.fn() },
      },
      client: {
        conversation: { update: jest.fn() },
      },
    };
    tenantContext = { setContext: jest.fn() };
    contactsService = { create: jest.fn() };
    conversationsService = { create: jest.fn() };
    messagesService = { create: jest.fn(), list: jest.fn() };
    service = new WebchatService(prisma, tenantContext, contactsService, conversationsService, messagesService);
  });

  describe('start', () => {
    it('throws NotFoundError when the link page does not exist', async () => {
      prisma.raw.linkPage.findUnique.mockResolvedValue(null);
      await expect(service.start('missing')).rejects.toThrow(NotFoundError);
    });

    it('throws NotFoundError when the link page is a draft', async () => {
      prisma.raw.linkPage.findUnique.mockResolvedValue({ tenantId: 't1', status: 'DRAFT', chatEnabled: true });
      await expect(service.start('demo')).rejects.toThrow(NotFoundError);
    });

    it('throws NotFoundError when chat is not enabled', async () => {
      prisma.raw.linkPage.findUnique.mockResolvedValue({ tenantId: 't1', status: 'PUBLISHED', chatEnabled: false });
      await expect(service.start('demo')).rejects.toThrow(NotFoundError);
    });

    it('creates an anonymous contact + conversation, seeds tenant context, and returns a webchatToken', async () => {
      prisma.raw.linkPage.findUnique.mockResolvedValue({ tenantId: 't1', status: 'PUBLISHED', chatEnabled: true });
      contactsService.create.mockResolvedValue({ id: 'contact1' });
      conversationsService.create.mockResolvedValue({ id: 'conv1' });

      const result = await service.start('demo');

      expect(tenantContext.setContext).toHaveBeenCalledWith({ tenantId: 't1' });
      expect(contactsService.create).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Visitante web', source: 'WEBSITE' }),
      );
      expect(conversationsService.create).toHaveBeenCalledWith(
        expect.objectContaining({ contactId: 'contact1', channel: 'WEBCHAT' }),
      );
      expect(prisma.client.conversation.update).toHaveBeenCalledWith({
        where: { id: 'conv1' },
        data: { webchatToken: expect.any(String) },
      });
      expect(result).toEqual({ conversationId: 'conv1', webchatToken: expect.any(String) });
    });
  });

  describe('startFromStore', () => {
    it('throws NotFoundError when the store does not exist', async () => {
      prisma.raw.ecommerceStore.findUnique.mockResolvedValue(null);
      await expect(service.startFromStore('missing')).rejects.toThrow(NotFoundError);
    });

    it('throws NotFoundError when the store is a draft', async () => {
      prisma.raw.ecommerceStore.findUnique.mockResolvedValue({ tenantId: 't1', status: 'DRAFT', chatEnabled: true });
      await expect(service.startFromStore('demo')).rejects.toThrow(NotFoundError);
    });

    it('throws NotFoundError when the shopping assistant is not enabled', async () => {
      prisma.raw.ecommerceStore.findUnique.mockResolvedValue({ tenantId: 't1', status: 'PUBLISHED', chatEnabled: false });
      await expect(service.startFromStore('demo')).rejects.toThrow(NotFoundError);
    });

    it('creates an anonymous contact + conversation for the store tenant, same as the link-page flow', async () => {
      prisma.raw.ecommerceStore.findUnique.mockResolvedValue({ tenantId: 't1', status: 'PUBLISHED', chatEnabled: true });
      contactsService.create.mockResolvedValue({ id: 'contact1' });
      conversationsService.create.mockResolvedValue({ id: 'conv1' });

      const result = await service.startFromStore('papelito');

      expect(tenantContext.setContext).toHaveBeenCalledWith({ tenantId: 't1' });
      expect(conversationsService.create).toHaveBeenCalledWith(
        expect.objectContaining({ contactId: 'contact1', channel: 'WEBCHAT' }),
      );
      expect(result).toEqual({ conversationId: 'conv1', webchatToken: expect.any(String) });
    });
  });

  describe('sendMessage / listMessages — IDOR defense', () => {
    it('rejects when no webchatToken is provided', async () => {
      await expect(service.sendMessage('conv1', undefined as any, 'hola')).rejects.toThrow(ValidationError);
      expect(prisma.raw.conversation.findUnique).not.toHaveBeenCalled();
    });

    it('rejects when the conversation does not exist', async () => {
      prisma.raw.conversation.findUnique.mockResolvedValue(null);
      await expect(service.sendMessage('conv1', 'sometoken', 'hola')).rejects.toThrow(NotFoundError);
    });

    // The core defense: a webchatToken must match THIS conversation's own
    // token, not just be a valid-looking string — otherwise a visitor could
    // guess/enumerate conversationIds and read or post into someone else's
    // chat (a different tenant's, even) using a token issued for their own.
    it('rejects a webchatToken that does not belong to this conversation', async () => {
      prisma.raw.conversation.findUnique.mockResolvedValue({ id: 'conv1', tenantId: 't1', webchatToken: 'real-token' });
      await expect(service.sendMessage('conv1', 'someone-elses-token', 'hola')).rejects.toThrow(NotFoundError);
      expect(messagesService.create).not.toHaveBeenCalled();
    });

    it('rejects a non-WEBCHAT conversation (webchatToken is null)', async () => {
      prisma.raw.conversation.findUnique.mockResolvedValue({ id: 'conv1', tenantId: 't1', webchatToken: null });
      await expect(service.sendMessage('conv1', 'any-token', 'hola')).rejects.toThrow(NotFoundError);
    });

    it('delegates to MessagesService.create as an INBOUND message once the token matches', async () => {
      prisma.raw.conversation.findUnique.mockResolvedValue({ id: 'conv1', tenantId: 't1', webchatToken: 'real-token' });
      await service.sendMessage('conv1', 'real-token', 'hola, quiero info');

      expect(tenantContext.setContext).toHaveBeenCalledWith({ tenantId: 't1' });
      expect(messagesService.create).toHaveBeenCalledWith(
        'conv1',
        '',
        expect.objectContaining({ direction: 'INBOUND', content: 'hola, quiero info' }),
      );
    });

    it('delegates to MessagesService.list once the token matches', async () => {
      prisma.raw.conversation.findUnique.mockResolvedValue({ id: 'conv1', tenantId: 't1', webchatToken: 'real-token' });
      await service.listMessages('conv1', 'real-token');
      expect(messagesService.list).toHaveBeenCalledWith('conv1');
    });
  });
});
