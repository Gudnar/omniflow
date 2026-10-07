import { ConversationsService } from './conversations.service';
import { NotFoundError } from '@omniflow/utils';

describe('ConversationsService', () => {
  let service: ConversationsService;
  let prisma: any;
  let tx: any;
  let contactsService: any;
  let queueService: any;
  let eventEmitter: any;

  beforeEach(() => {
    tx = {
      contactChannel: { upsert: jest.fn() },
      conversation: { create: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
      message: { create: jest.fn().mockResolvedValue({ id: 'msg1' }) },
    };
    prisma = {
      client: {
        conversation: {
          findMany: jest.fn(),
          findUnique: jest.fn(),
          update: jest.fn(),
        },
        $transaction: jest.fn((cb: any) => cb(tx)),
      },
    };
    contactsService = { findOne: jest.fn().mockResolvedValue({ id: 'ct1' }) };
    queueService = { enqueueAiReply: jest.fn() };
    eventEmitter = { emit: jest.fn() };
    service = new ConversationsService(prisma, contactsService, queueService, eventEmitter);
  });

  describe('list', () => {
    it('applies optional filters and omits absent ones', async () => {
      prisma.client.conversation.findMany.mockResolvedValue([]);
      await service.list('tenant-1', { status: 'OPEN' as any });
      const callArgs = prisma.client.conversation.findMany.mock.calls[0][0];
      expect(callArgs.where).toEqual({ tenantId: 'tenant-1', status: 'OPEN' });
      expect(callArgs.orderBy).toEqual([{ lastMessageAt: 'desc' }, { createdAt: 'desc' }]);
    });

    it('applies all filters when provided', async () => {
      prisma.client.conversation.findMany.mockResolvedValue([]);
      await service.list('tenant-1', {
        status: 'OPEN' as any,
        channel: 'WHATSAPP' as any,
        contactId: 'ct1',
        branchId: 'b1',
        assignedToId: 'u1',
      });
      const callArgs = prisma.client.conversation.findMany.mock.calls[0][0];
      expect(callArgs.where).toEqual({
        tenantId: 'tenant-1',
        status: 'OPEN',
        channel: 'WHATSAPP',
        contactId: 'ct1',
        branchId: 'b1',
        assignedToId: 'u1',
      });
    });
  });

  describe('findOne', () => {
    it('throws NotFoundError when missing', async () => {
      prisma.client.conversation.findUnique.mockResolvedValue(null);
      await expect(service.findOne('missing')).rejects.toThrow(NotFoundError);
    });
  });

  describe('create', () => {
    it('throws NotFoundError(Contact) before touching the transaction', async () => {
      contactsService.findOne.mockRejectedValue(new NotFoundError('Contact'));
      await expect(service.create({ contactId: 'missing', channel: 'WHATSAPP' } as any)).rejects.toThrow(
        NotFoundError,
      );
      expect(prisma.client.$transaction).not.toHaveBeenCalled();
    });

    it('skips contactChannel.upsert and message.create when externalId/firstMessageContent are absent', async () => {
      tx.conversation.create.mockResolvedValue({ id: 'conv1' });
      tx.conversation.findUnique.mockResolvedValue({ id: 'conv1', tenantId: 'tenant-1' });

      await service.create({ contactId: 'ct1', channel: 'WHATSAPP' } as any);

      expect(tx.contactChannel.upsert).not.toHaveBeenCalled();
      expect(tx.message.create).not.toHaveBeenCalled();
      expect(tx.conversation.create.mock.calls[0][0].data.lastMessageAt).toBeUndefined();
      // No first message was created, so there's nothing new for staff to be
      // notified about live, and no reply to trigger.
      expect(eventEmitter.emit).not.toHaveBeenCalled();
      expect(queueService.enqueueAiReply).not.toHaveBeenCalled();
    });

    it('defaults isNewContact to false and adReferral to undefined when not provided', async () => {
      tx.conversation.create.mockResolvedValue({ id: 'conv1' });
      tx.conversation.findUnique.mockResolvedValue({ id: 'conv1', tenantId: 'tenant-1' });

      await service.create({ contactId: 'ct1', channel: 'WHATSAPP' } as any);

      expect(tx.conversation.create.mock.calls[0][0].data.isNewContact).toBe(false);
      expect(tx.conversation.create.mock.calls[0][0].data.adReferral).toBeUndefined();
    });

    it('persists isNewContact and adReferral when the caller provides them', async () => {
      tx.conversation.create.mockResolvedValue({ id: 'conv1' });
      tx.conversation.findUnique.mockResolvedValue({ id: 'conv1', tenantId: 'tenant-1' });
      const adReferral = { sourceUrl: 'https://fb.me/ad1', headline: 'Promo' };

      await service.create({ contactId: 'ct1', channel: 'WHATSAPP', isNewContact: true, adReferral } as any);

      expect(tx.conversation.create.mock.calls[0][0].data.isNewContact).toBe(true);
      expect(tx.conversation.create.mock.calls[0][0].data.adReferral).toEqual(adReferral);
    });

    it('upserts the contact channel and creates a first inbound message when provided', async () => {
      tx.contactChannel.upsert.mockResolvedValue({ id: 'cc1' });
      tx.conversation.create.mockResolvedValue({ id: 'conv1' });
      tx.conversation.findUnique.mockResolvedValue({ id: 'conv1', tenantId: 'tenant-1' });

      await service.create({
        contactId: 'ct1',
        channel: 'WHATSAPP',
        externalId: '+59171234567',
        firstMessageContent: 'Hola',
      } as any);

      expect(tx.contactChannel.upsert).toHaveBeenCalledWith({
        where: { contactId_channel: { contactId: 'ct1', channel: 'WHATSAPP' } },
        update: { externalId: '+59171234567' },
        create: { contactId: 'ct1', channel: 'WHATSAPP', externalId: '+59171234567' },
      });
      expect(tx.conversation.create.mock.calls[0][0].data.contactChannelId).toBe('cc1');
      expect(tx.conversation.create.mock.calls[0][0].data.lastMessageAt).toBeInstanceOf(Date);
      expect(tx.message.create).toHaveBeenCalledWith({
        data: { conversationId: 'conv1', direction: 'INBOUND', type: 'TEXT', content: 'Hola' },
      });
    });

    it('passes firstMessageExternalId through to the inline first-message create', async () => {
      tx.contactChannel.upsert.mockResolvedValue({ id: 'cc1' });
      tx.conversation.create.mockResolvedValue({ id: 'conv1' });
      tx.conversation.findUnique.mockResolvedValue({ id: 'conv1', tenantId: 'tenant-1' });

      await service.create({
        contactId: 'ct1',
        channel: 'WHATSAPP',
        externalId: '+59171234567',
        firstMessageContent: 'Hola',
        firstMessageExternalId: 'wamid.TESTID001',
      } as any);

      expect(tx.message.create.mock.calls[0][0].data.externalId).toBe('wamid.TESTID001');
    });

    // The bug this covers: a brand-new contact's very first message (the
    // common case for every real-channel webhook — WhatsApp/Instagram/
    // Messenger/TikTok) writes the message directly above, bypassing
    // MessagesService.create() — the only other place that emits
    // 'message.created' and enqueues the AI reply. Without this, staff never
    // saw the conversation appear live (had to reload) and the agent never
    // replied to a contact's first-ever message.
    it('emits message.created and enqueues an AI reply for the first message, using the real message id and tenantId', async () => {
      tx.contactChannel.upsert.mockResolvedValue({ id: 'cc1' });
      tx.conversation.create.mockResolvedValue({ id: 'conv1' });
      tx.conversation.findUnique.mockResolvedValue({ id: 'conv1', tenantId: 'tenant-1' });
      tx.message.create.mockResolvedValue({ id: 'msg-first' });

      await service.create({
        contactId: 'ct1',
        channel: 'WHATSAPP',
        externalId: '+59171234567',
        firstMessageContent: 'Hola',
      } as any);

      expect(eventEmitter.emit).toHaveBeenCalledWith('message.created', { conversationId: 'conv1', tenantId: 'tenant-1' });
      expect(queueService.enqueueAiReply).toHaveBeenCalledWith('tenant-1', 'conv1', 'msg-first');
    });

    it('still emits message.created but skips enqueuing the AI reply when skipAiReply is true', async () => {
      tx.conversation.create.mockResolvedValue({ id: 'conv1' });
      tx.conversation.findUnique.mockResolvedValue({ id: 'conv1', tenantId: 'tenant-1' });
      tx.message.create.mockResolvedValue({ id: 'msg-first' });

      await service.create({
        contactId: 'ct1',
        channel: 'WHATSAPP',
        firstMessageContent: 'Hola',
        skipAiReply: true,
      } as any);

      expect(eventEmitter.emit).toHaveBeenCalledWith('message.created', { conversationId: 'conv1', tenantId: 'tenant-1' });
      expect(queueService.enqueueAiReply).not.toHaveBeenCalled();
    });
  });

  describe('setAiPaused', () => {
    it('throws NotFoundError when the conversation is missing', async () => {
      prisma.client.conversation.findUnique.mockResolvedValue(null);
      await expect(service.setAiPaused('missing', true)).rejects.toThrow(NotFoundError);
    });

    it('updates aiPaused', async () => {
      prisma.client.conversation.findUnique.mockResolvedValue({ id: 'conv1' });
      prisma.client.conversation.update.mockResolvedValue({ id: 'conv1', aiPaused: false });
      await service.setAiPaused('conv1', false);
      expect(prisma.client.conversation.update).toHaveBeenCalledWith({
        where: { id: 'conv1' },
        data: { aiPaused: false },
      });
    });
  });

  describe('updateStatus', () => {
    it('throws NotFoundError when the conversation is missing', async () => {
      prisma.client.conversation.findUnique.mockResolvedValue(null);
      await expect(service.updateStatus('missing', { status: 'CLOSED' } as any)).rejects.toThrow(
        NotFoundError,
      );
    });

    it('updates the status', async () => {
      prisma.client.conversation.findUnique.mockResolvedValue({ id: 'conv1' });
      prisma.client.conversation.update.mockResolvedValue({ id: 'conv1', status: 'CLOSED' });
      await service.updateStatus('conv1', { status: 'CLOSED' } as any);
      expect(prisma.client.conversation.update).toHaveBeenCalledWith({
        where: { id: 'conv1' },
        data: { status: 'CLOSED' },
      });
    });
  });

  describe('assign', () => {
    it('updates assignedToId and logs a SYSTEM message with the actor as sender', async () => {
      prisma.client.conversation.findUnique.mockResolvedValue({ id: 'conv1' });
      tx.conversation.update.mockResolvedValue({ id: 'conv1', assignedToId: 'u2' });

      await service.assign('conv1', { assignedToId: 'u2' }, 'u1');

      expect(tx.conversation.update).toHaveBeenCalledWith({
        where: { id: 'conv1' },
        data: { assignedToId: 'u2' },
      });
      expect(tx.message.create).toHaveBeenCalledWith({
        data: {
          conversationId: 'conv1',
          direction: 'OUTBOUND',
          type: 'SYSTEM',
          senderId: 'u1',
          content: 'Conversación asignada a u2',
        },
      });
    });

    it('unassigns with null and uses the unassigned copy', async () => {
      prisma.client.conversation.findUnique.mockResolvedValue({ id: 'conv1' });
      tx.conversation.update.mockResolvedValue({ id: 'conv1', assignedToId: null });

      await service.assign('conv1', {}, 'u1');

      expect(tx.conversation.update).toHaveBeenCalledWith({
        where: { id: 'conv1' },
        data: { assignedToId: null },
      });
      expect(tx.message.create.mock.calls[0][0].data.content).toBe('Conversación sin asignar');
    });
  });

  describe('generateWebLink', () => {
    it('throws NotFoundError when the conversation does not exist', async () => {
      prisma.client.conversation.findUnique.mockResolvedValue(null);
      await expect(service.generateWebLink('missing')).rejects.toThrow(NotFoundError);
    });

    it('sets a fresh webchatToken on the conversation and returns a matching URL', async () => {
      prisma.client.conversation.findUnique.mockResolvedValue({ id: 'conv1' });
      prisma.client.conversation.update.mockResolvedValue({ id: 'conv1', webchatToken: 'whatever' });

      const result = await service.generateWebLink('conv1');

      expect(prisma.client.conversation.update).toHaveBeenCalledWith({
        where: { id: 'conv1' },
        data: { webchatToken: expect.any(String) },
      });
      const [[{ data }]] = prisma.client.conversation.update.mock.calls;
      expect(result).toEqual({ url: expect.stringContaining(`/chat/${data.webchatToken}`), token: data.webchatToken });
    });

    it('overwrites any previous token, invalidating the old link', async () => {
      prisma.client.conversation.findUnique.mockResolvedValue({ id: 'conv1', webchatToken: 'old-token' });
      prisma.client.conversation.update.mockResolvedValue({ id: 'conv1' });

      const result = await service.generateWebLink('conv1');

      expect(result.token).not.toBe('old-token');
    });
  });
});
