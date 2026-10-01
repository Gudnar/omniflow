import { MessagesService } from './messages.service';
import { ValidationError } from '@omniflow/utils';

describe('MessagesService', () => {
  let service: MessagesService;
  let prisma: any;
  let tx: any;
  let conversationsService: any;
  let queueService: any;
  let eventsService: any;
  let eventEmitter: any;

  beforeEach(() => {
    tx = {
      message: { create: jest.fn(), findUnique: jest.fn() },
      attachment: { create: jest.fn() },
      conversation: { update: jest.fn() },
    };
    prisma = {
      client: {
        message: { findMany: jest.fn() },
        metaConnection: { findUnique: jest.fn() },
        tikTokConnection: { findUnique: jest.fn() },
        $transaction: jest.fn((cb: any) => cb(tx)),
      },
    };
    // channel undefined by default -> no enqueue branch is entered unless a
    // test explicitly sets a channel.
    conversationsService = {
      findOne: jest.fn().mockResolvedValue({ id: 'conv1', tenantId: 'tenant-1', contactId: 'contact-1' }),
    };
    queueService = { enqueueChannelOutboundMessage: jest.fn(), enqueueAiReply: jest.fn(), enqueueTranscription: jest.fn() };
    eventsService = { emit: jest.fn() };
    eventEmitter = { emit: jest.fn() };
    service = new MessagesService(prisma, conversationsService, queueService, eventsService, eventEmitter);
  });

  describe('list', () => {
    it('throws NotFoundError via conversationsService when the conversation is missing', async () => {
      conversationsService.findOne.mockRejectedValue(new Error('Conversation not found'));
      await expect(service.list('missing')).rejects.toThrow();
      expect(prisma.client.message.findMany).not.toHaveBeenCalled();
    });

    it('lists messages ordered ascending with attachments included', async () => {
      prisma.client.message.findMany.mockResolvedValue([]);
      await service.list('conv1');
      expect(prisma.client.message.findMany).toHaveBeenCalledWith({
        where: { conversationId: 'conv1' },
        include: { attachments: true },
        orderBy: { createdAt: 'asc' },
      });
    });
  });

  describe('create', () => {
    beforeEach(() => {
      tx.message.create.mockResolvedValue({ id: 'msg1' });
      tx.message.findUnique.mockResolvedValue({ id: 'msg1' });
    });

    it('forces senderId to null for INBOUND messages even if an actor is passed', async () => {
      await service.create('conv1', 'agent-1', { direction: 'INBOUND', content: 'Hola' } as any);
      expect(tx.message.create).toHaveBeenCalledWith({
        data: { conversationId: 'conv1', direction: 'INBOUND', type: 'TEXT', content: 'Hola', senderId: null },
      });
    });

    it('emits message.received for INBOUND messages, scoped to the contact', async () => {
      await service.create('conv1', 'agent-1', { direction: 'INBOUND', content: 'Hola' } as any);
      expect(eventsService.emit).toHaveBeenCalledWith(
        'message.received',
        { conversationId: 'conv1', messageId: 'msg1', content: 'Hola' },
        'contact-1',
      );
    });

    it('does not emit message.received for OUTBOUND messages', async () => {
      await service.create('conv1', 'agent-1', { direction: 'OUTBOUND', content: 'Hola' } as any);
      expect(eventsService.emit).not.toHaveBeenCalled();
    });

    it('emits message.created (for RealtimeGateway) with the tenantId for both INBOUND and OUTBOUND messages', async () => {
      await service.create('conv1', 'agent-1', { direction: 'INBOUND', content: 'Hola' } as any);
      expect(eventEmitter.emit).toHaveBeenCalledWith('message.created', { conversationId: 'conv1', tenantId: 'tenant-1' });

      eventEmitter.emit.mockClear();
      await service.create('conv1', 'agent-1', { direction: 'OUTBOUND', content: 'Hola' } as any);
      expect(eventEmitter.emit).toHaveBeenCalledWith('message.created', { conversationId: 'conv1', tenantId: 'tenant-1' });
    });

    it('enqueues an AI reply job for INBOUND messages', async () => {
      await service.create('conv1', 'agent-1', { direction: 'INBOUND', content: 'Hola' } as any);
      expect(queueService.enqueueAiReply).toHaveBeenCalledWith('tenant-1', 'conv1', 'msg1');
    });

    it('does not enqueue an AI reply job for OUTBOUND messages', async () => {
      await service.create('conv1', 'agent-1', { direction: 'OUTBOUND', content: 'Hola' } as any);
      expect(queueService.enqueueAiReply).not.toHaveBeenCalled();
    });

    it('enqueues a transcription job instead of an AI reply for an INBOUND AUDIO message', async () => {
      await service.create('conv1', 'agent-1', { direction: 'INBOUND', type: 'AUDIO', content: '' } as any);
      expect(queueService.enqueueTranscription).toHaveBeenCalledWith('tenant-1', 'msg1');
      expect(queueService.enqueueAiReply).not.toHaveBeenCalled();
    });

    it('does not enqueue a transcription job for a non-AUDIO INBOUND message', async () => {
      await service.create('conv1', 'agent-1', { direction: 'INBOUND', content: 'Hola' } as any);
      expect(queueService.enqueueTranscription).not.toHaveBeenCalled();
    });

    it('sets senderId to the acting user for OUTBOUND messages', async () => {
      await service.create('conv1', 'agent-1', { direction: 'OUTBOUND', content: 'Hola' } as any);
      expect(tx.message.create).toHaveBeenCalledWith({
        data: { conversationId: 'conv1', direction: 'OUTBOUND', type: 'TEXT', content: 'Hola', senderId: 'agent-1' },
      });
    });

    it('rejects INBOUND + NOTE without calling $transaction', async () => {
      await expect(
        service.create('conv1', 'agent-1', { direction: 'INBOUND', type: 'NOTE', content: 'x' } as any),
      ).rejects.toThrow(ValidationError);
      expect(prisma.client.$transaction).not.toHaveBeenCalled();
    });

    it('creates an attachment linked to the new message when provided', async () => {
      await service.create('conv1', 'agent-1', {
        direction: 'OUTBOUND',
        content: 'Foto',
        attachmentUrl: 'https://example.com/f.png',
        attachmentMimeType: 'image/png',
        attachmentFileName: 'f.png',
        attachmentSize: 1024,
      } as any);

      expect(tx.attachment.create).toHaveBeenCalledWith({
        data: {
          messageId: 'msg1',
          url: 'https://example.com/f.png',
          mimeType: 'image/png',
          fileName: 'f.png',
          size: 1024,
        },
      });
    });

    it('does not create an attachment when none is provided', async () => {
      await service.create('conv1', 'agent-1', { direction: 'OUTBOUND', content: 'Hola' } as any);
      expect(tx.attachment.create).not.toHaveBeenCalled();
    });

    it('always bumps conversation.lastMessageAt', async () => {
      await service.create('conv1', 'agent-1', { direction: 'OUTBOUND', content: 'Hola' } as any);
      expect(tx.conversation.update).toHaveBeenCalledWith({
        where: { id: 'conv1' },
        data: { lastMessageAt: expect.any(Date) },
      });
    });

    it('passes externalId through to the created message', async () => {
      await service.create('conv1', 'agent-1', {
        direction: 'OUTBOUND',
        content: 'Hola',
        externalId: 'wamid.ABC123',
      } as any);
      expect(tx.message.create.mock.calls[0][0].data.externalId).toBe('wamid.ABC123');
    });

    it('passes ctaPayload through to the created message when provided (AiReplyService only — no HTTP DTO field allows this)', async () => {
      await service.create('conv1', 'agent-1', {
        direction: 'OUTBOUND',
        type: 'CTA',
        content: 'Mirá la tienda\n\nhttp://localhost:3000/tienda/demo?s=abc',
        ctaPayload: { action: 'STORE', url: 'http://localhost:3000/tienda/demo?s=abc' },
      } as any);
      expect(tx.message.create.mock.calls[0][0].data.ctaPayload).toEqual({
        action: 'STORE',
        url: 'http://localhost:3000/tienda/demo?s=abc',
      });
    });

    describe.each(['WHATSAPP', 'INSTAGRAM', 'MESSENGER'] as const)('%s outbound enqueue (via MetaConnection)', (channel) => {
      it('enqueues when direction is OUTBOUND and the connection is CONNECTED', async () => {
        conversationsService.findOne.mockResolvedValue({ id: 'conv1', tenantId: 'tenant-1', channel });
        prisma.client.metaConnection.findUnique.mockResolvedValue({ status: 'CONNECTED' });

        await service.create('conv1', 'agent-1', { direction: 'OUTBOUND', content: 'Hola' } as any);

        expect(prisma.client.metaConnection.findUnique).toHaveBeenCalledWith({
          where: { tenantId_channel: { tenantId: 'tenant-1', channel } },
        });
        expect(queueService.enqueueChannelOutboundMessage).toHaveBeenCalledWith(channel, 'msg1');
      });

      it('does not enqueue for INBOUND messages', async () => {
        conversationsService.findOne.mockResolvedValue({ id: 'conv1', tenantId: 'tenant-1', channel });
        prisma.client.metaConnection.findUnique.mockResolvedValue({ status: 'CONNECTED' });

        await service.create('conv1', 'agent-1', { direction: 'INBOUND', content: 'Hola' } as any);

        expect(queueService.enqueueChannelOutboundMessage).not.toHaveBeenCalled();
      });

      it('does not enqueue when there is no connection for the tenant', async () => {
        conversationsService.findOne.mockResolvedValue({ id: 'conv1', tenantId: 'tenant-1', channel });
        prisma.client.metaConnection.findUnique.mockResolvedValue(null);

        await service.create('conv1', 'agent-1', { direction: 'OUTBOUND', content: 'Hola' } as any);

        expect(queueService.enqueueChannelOutboundMessage).not.toHaveBeenCalled();
      });

      it('does not enqueue when the connection is DISCONNECTED', async () => {
        conversationsService.findOne.mockResolvedValue({ id: 'conv1', tenantId: 'tenant-1', channel });
        prisma.client.metaConnection.findUnique.mockResolvedValue({ status: 'DISCONNECTED' });

        await service.create('conv1', 'agent-1', { direction: 'OUTBOUND', content: 'Hola' } as any);

        expect(queueService.enqueueChannelOutboundMessage).not.toHaveBeenCalled();
      });
    });

    describe('TIKTOK outbound enqueue (via TikTokConnection)', () => {
      it('enqueues when direction is OUTBOUND and the connection is CONNECTED', async () => {
        conversationsService.findOne.mockResolvedValue({ id: 'conv1', tenantId: 'tenant-1', channel: 'TIKTOK' });
        prisma.client.tikTokConnection.findUnique.mockResolvedValue({ status: 'CONNECTED' });

        await service.create('conv1', 'agent-1', { direction: 'OUTBOUND', content: 'Hola' } as any);

        expect(prisma.client.tikTokConnection.findUnique).toHaveBeenCalledWith({
          where: { tenantId: 'tenant-1' },
        });
        expect(queueService.enqueueChannelOutboundMessage).toHaveBeenCalledWith('TIKTOK', 'msg1');
      });

      it('does not enqueue when there is no connection for the tenant', async () => {
        conversationsService.findOne.mockResolvedValue({ id: 'conv1', tenantId: 'tenant-1', channel: 'TIKTOK' });
        prisma.client.tikTokConnection.findUnique.mockResolvedValue(null);

        await service.create('conv1', 'agent-1', { direction: 'OUTBOUND', content: 'Hola' } as any);

        expect(queueService.enqueueChannelOutboundMessage).not.toHaveBeenCalled();
      });
    });

    // The bug this covers: /chat/[token] reuses the SAME Conversation as the
    // real WhatsApp thread, so before this flag existed, every reply (agent
    // or operator) sent while the customer was chatting via the web window
    // also silently re-dispatched to their real WhatsApp.
    describe('lastInboundViaWebWindow', () => {
      it('sets the flag on an INBOUND message created via the web window', async () => {
        conversationsService.findOne.mockResolvedValue({ id: 'conv1', tenantId: 'tenant-1', channel: 'WHATSAPP' });

        await service.create('conv1', '', { direction: 'INBOUND', content: 'Hola', viaWebWindow: true } as any);

        expect(tx.conversation.update).toHaveBeenCalledWith(
          expect.objectContaining({ data: expect.objectContaining({ lastInboundViaWebWindow: true }) }),
        );
      });

      it('resets the flag to false on a real (webhook) INBOUND message', async () => {
        conversationsService.findOne.mockResolvedValue({ id: 'conv1', tenantId: 'tenant-1', channel: 'WHATSAPP' });

        await service.create('conv1', '', { direction: 'INBOUND', content: 'Hola real' } as any);

        expect(tx.conversation.update).toHaveBeenCalledWith(
          expect.objectContaining({ data: expect.objectContaining({ lastInboundViaWebWindow: false }) }),
        );
      });

      it('never touches the flag on an OUTBOUND message', async () => {
        conversationsService.findOne.mockResolvedValue({ id: 'conv1', tenantId: 'tenant-1', channel: 'WHATSAPP' });

        await service.create('conv1', 'agent-1', { direction: 'OUTBOUND', content: 'Respuesta' } as any);

        expect(tx.conversation.update.mock.calls[0][0].data).not.toHaveProperty('lastInboundViaWebWindow');
      });

      it('skips real-channel dispatch for an OUTBOUND reply when the conversation is flagged as active in the web window', async () => {
        conversationsService.findOne.mockResolvedValue({
          id: 'conv1',
          tenantId: 'tenant-1',
          channel: 'WHATSAPP',
          lastInboundViaWebWindow: true,
        });
        prisma.client.metaConnection.findUnique.mockResolvedValue({ status: 'CONNECTED' });

        await service.create('conv1', 'agent-1', { direction: 'OUTBOUND', content: 'Respuesta del agente' } as any);

        expect(queueService.enqueueChannelOutboundMessage).not.toHaveBeenCalled();
      });

      it('still dispatches to the real channel when the flag is false', async () => {
        conversationsService.findOne.mockResolvedValue({
          id: 'conv1',
          tenantId: 'tenant-1',
          channel: 'WHATSAPP',
          lastInboundViaWebWindow: false,
        });
        prisma.client.metaConnection.findUnique.mockResolvedValue({ status: 'CONNECTED' });

        await service.create('conv1', 'agent-1', { direction: 'OUTBOUND', content: 'Respuesta del agente' } as any);

        expect(queueService.enqueueChannelOutboundMessage).toHaveBeenCalledWith('WHATSAPP', 'msg1');
      });
    });

    it('does not enqueue for the reserved/unused FACEBOOK channel', async () => {
      conversationsService.findOne.mockResolvedValue({ id: 'conv1', tenantId: 'tenant-1', channel: 'FACEBOOK' });

      await service.create('conv1', 'agent-1', { direction: 'OUTBOUND', content: 'Hola' } as any);

      expect(prisma.client.metaConnection.findUnique).not.toHaveBeenCalled();
      expect(prisma.client.tikTokConnection.findUnique).not.toHaveBeenCalled();
      expect(queueService.enqueueChannelOutboundMessage).not.toHaveBeenCalled();
    });
  });
});
