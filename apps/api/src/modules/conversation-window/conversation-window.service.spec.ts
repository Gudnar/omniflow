import { ConversationWindowService } from './conversation-window.service';
import { NotFoundError } from '@omniflow/utils';

describe('ConversationWindowService', () => {
  let service: ConversationWindowService;
  let prisma: any;
  let tenantContext: any;
  let messagesService: any;
  let queueService: any;

  beforeEach(() => {
    prisma = {
      raw: {
        conversation: { findUnique: jest.fn() },
        metaConnection: { findUnique: jest.fn() },
        tenant: { findUnique: jest.fn() },
        message: { findMany: jest.fn() },
      },
      client: {
        conversation: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
      },
    };
    tenantContext = { setContext: jest.fn() };
    messagesService = { create: jest.fn() };
    queueService = { enqueueAiReply: jest.fn() };
    service = new ConversationWindowService(prisma, tenantContext, messagesService, queueService);
  });

  describe('getWindow', () => {
    it('throws NotFoundError when the token matches no conversation', async () => {
      prisma.raw.conversation.findUnique.mockResolvedValue(null);
      await expect(service.getWindow('bad-token')).rejects.toThrow(NotFoundError);
    });

    it('seeds tenant context from the resolved conversation, never from client input', async () => {
      prisma.raw.conversation.findUnique.mockResolvedValue({ id: 'conv1', tenantId: 't1', channel: 'WHATSAPP' });
      prisma.raw.metaConnection.findUnique.mockResolvedValue(null);
      prisma.raw.tenant.findUnique.mockResolvedValue({ name: 'Demo', logo: null });
      prisma.raw.message.findMany.mockResolvedValue([]);

      await service.getWindow('real-token');

      expect(tenantContext.setContext).toHaveBeenCalledWith({ tenantId: 't1' });
    });

    it('prefers the channel connection displayName, falling back to the tenant name', async () => {
      prisma.raw.conversation.findUnique.mockResolvedValue({ id: 'conv1', tenantId: 't1', channel: 'WHATSAPP' });
      prisma.raw.tenant.findUnique.mockResolvedValue({ name: 'Demo Tenant', logo: null });
      prisma.raw.message.findMany.mockResolvedValue([]);

      prisma.raw.metaConnection.findUnique.mockResolvedValue({ displayName: '+591 700 12345' });
      let result = await service.getWindow('t1');
      expect(result.businessName).toBe('+591 700 12345');

      prisma.raw.metaConnection.findUnique.mockResolvedValue(null);
      result = await service.getWindow('t1');
      expect(result.businessName).toBe('Demo Tenant');
    });

    // The security hole found during planning: internal staff notes and
    // system audit messages must never reach a customer-facing view.
    it('excludes NOTE and SYSTEM messages from the returned history', async () => {
      prisma.raw.conversation.findUnique.mockResolvedValue({ id: 'conv1', tenantId: 't1', channel: 'WHATSAPP' });
      prisma.raw.metaConnection.findUnique.mockResolvedValue(null);
      prisma.raw.tenant.findUnique.mockResolvedValue({ name: 'Demo', logo: null });
      prisma.raw.message.findMany.mockResolvedValue([{ id: 'm1', type: 'TEXT', content: 'hola', attachments: [] }]);

      await service.getWindow('token');

      expect(prisma.raw.message.findMany).toHaveBeenCalledWith({
        where: { conversationId: 'conv1', type: { in: ['TEXT', 'AUDIO', 'TEMPLATE', 'CTA'] } },
        include: { attachments: true },
        orderBy: { createdAt: 'asc' },
      });
    });

    it('never exposes tenantId, senderId or campaignId on returned messages', async () => {
      prisma.raw.conversation.findUnique.mockResolvedValue({ id: 'conv1', tenantId: 't1', channel: 'WHATSAPP' });
      prisma.raw.metaConnection.findUnique.mockResolvedValue(null);
      prisma.raw.tenant.findUnique.mockResolvedValue({ name: 'Demo', logo: null });
      prisma.raw.message.findMany.mockResolvedValue([
        {
          id: 'm1',
          tenantId: 't1',
          conversationId: 'conv1',
          senderId: 'user-1',
          campaignId: null,
          direction: 'INBOUND',
          type: 'TEXT',
          content: 'hola',
          createdAt: new Date('2026-01-01'),
          attachments: [{ id: 'a1', url: 'https://x/f.png', mimeType: 'image/png', fileName: 'f.png', size: 1024 }],
        },
      ]);

      const result = await service.getWindow('token');

      expect(result.messages).toEqual([
        {
          id: 'm1',
          direction: 'INBOUND',
          type: 'TEXT',
          content: 'hola',
          createdAt: new Date('2026-01-01'),
          ctaPayload: null,
          attachments: [{ id: 'a1', url: 'https://x/f.png', mimeType: 'image/png', fileName: 'f.png' }],
        },
      ]);
    });

    // CTA is how the AI agent's send_storefront_link tool reaches this
    // window — unlike NOTE/SYSTEM, it must pass the customer-visible filter
    // and keep its ctaPayload intact so the frontend can render the button.
    it('includes CTA messages with their ctaPayload intact', async () => {
      prisma.raw.conversation.findUnique.mockResolvedValue({ id: 'conv1', tenantId: 't1', channel: 'WHATSAPP' });
      prisma.raw.metaConnection.findUnique.mockResolvedValue(null);
      prisma.raw.tenant.findUnique.mockResolvedValue({ name: 'Demo', logo: null });
      prisma.raw.message.findMany.mockResolvedValue([
        {
          id: 'm1',
          type: 'CTA',
          direction: 'OUTBOUND',
          content: 'Mirá la tienda\n\nhttp://localhost:3000/tienda/demo?s=abc',
          createdAt: new Date('2026-01-01'),
          ctaPayload: { action: 'STORE', url: 'http://localhost:3000/tienda/demo?s=abc' },
          attachments: [],
        },
      ]);

      const result = await service.getWindow('token');

      expect(prisma.raw.message.findMany).toHaveBeenCalledWith({
        where: { conversationId: 'conv1', type: { in: ['TEXT', 'AUDIO', 'TEMPLATE', 'CTA'] } },
        include: { attachments: true },
        orderBy: { createdAt: 'asc' },
      });
      expect(result.messages[0]).toEqual(
        expect.objectContaining({
          type: 'CTA',
          ctaPayload: { action: 'STORE', url: 'http://localhost:3000/tienda/demo?s=abc' },
        }),
      );
    });

    describe('proactive web-chat greeting', () => {
      beforeEach(() => {
        prisma.raw.conversation.findUnique.mockResolvedValue({ id: 'conv1', tenantId: 't1', channel: 'WHATSAPP' });
        prisma.raw.metaConnection.findUnique.mockResolvedValue(null);
        prisma.raw.tenant.findUnique.mockResolvedValue({ name: 'Demo', logo: null });
        prisma.raw.message.findMany.mockResolvedValue([]);
      });

      it('on the first open, clears aiPaused, marks webWindowGreetedAt, and enqueues the greeting with no messageId', async () => {
        prisma.client.conversation.updateMany.mockResolvedValue({ count: 1 });

        await service.getWindow('token');

        expect(prisma.client.conversation.updateMany).toHaveBeenCalledWith({
          where: { id: 'conv1', webWindowGreetedAt: null },
          data: { webWindowGreetedAt: expect.any(Date), aiPaused: false, lastInboundViaWebWindow: true },
        });
        expect(queueService.enqueueAiReply).toHaveBeenCalledWith('t1', 'conv1', null);
      });

      it('does not re-enqueue on a later open once already greeted', async () => {
        prisma.client.conversation.updateMany.mockResolvedValue({ count: 0 });

        await service.getWindow('token');

        expect(queueService.enqueueAiReply).not.toHaveBeenCalled();
      });
    });
  });

  describe('sendMessage', () => {
    it('throws NotFoundError for an unknown token', async () => {
      prisma.raw.conversation.findUnique.mockResolvedValue(null);
      await expect(service.sendMessage('bad-token', 'hola')).rejects.toThrow(NotFoundError);
      expect(messagesService.create).not.toHaveBeenCalled();
    });

    it('creates an INBOUND message on the resolved conversation', async () => {
      prisma.raw.conversation.findUnique.mockResolvedValue({ id: 'conv1', tenantId: 't1', channel: 'WHATSAPP' });

      await service.sendMessage('real-token', 'quiero seguir por acá');

      expect(tenantContext.setContext).toHaveBeenCalledWith({ tenantId: 't1' });
      expect(messagesService.create).toHaveBeenCalledWith(
        'conv1',
        '',
        expect.objectContaining({ direction: 'INBOUND', content: 'quiero seguir por acá' }),
      );
    });

    // The bug this covers: without this flag, a reply sent while the
    // customer chats via /chat/[token] also silently re-dispatched to their
    // real WhatsApp — see MessagesService.create()'s lastInboundViaWebWindow
    // handling.
    it('flags the message as coming from the web window', async () => {
      prisma.raw.conversation.findUnique.mockResolvedValue({ id: 'conv1', tenantId: 't1', channel: 'WHATSAPP' });

      await service.sendMessage('real-token', 'quiero seguir por acá');

      expect(messagesService.create).toHaveBeenCalledWith(
        'conv1',
        '',
        expect.objectContaining({ viaWebWindow: true }),
      );
    });
  });
});
