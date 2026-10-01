import { TikTokWebhookService } from './tiktok-webhook.service';

function buildPayload(overrides: any = {}) {
  return {
    event: 'message.received',
    data: {
      business_id: 'biz_1234567890',
      sender: { open_id: 'open_abc123' },
      message: { text: 'Hola desde TikTok', message_id: 'ttmsg.TESTID001' },
    },
    ...overrides,
  };
}

describe('TikTokWebhookService', () => {
  let service: TikTokWebhookService;
  let prisma: any;
  let tenantContext: any;
  let contactsService: any;
  let conversationsService: any;
  let messagesService: any;

  beforeEach(() => {
    prisma = {
      raw: {
        tikTokConnection: { findUnique: jest.fn() },
        message: { findUnique: jest.fn() },
      },
      client: {
        contactChannel: { findFirst: jest.fn() },
        conversation: { findFirst: jest.fn() },
      },
    };
    tenantContext = { setContext: jest.fn() };
    contactsService = { create: jest.fn().mockResolvedValue({ id: 'ct1' }) };
    conversationsService = { create: jest.fn().mockResolvedValue({ id: 'conv1' }) };
    messagesService = { create: jest.fn().mockResolvedValue({ id: 'msg1' }) };

    service = new TikTokWebhookService(
      prisma,
      tenantContext,
      contactsService,
      conversationsService,
      messagesService,
    );
  });

  it('no-ops on an unrecognized event type', async () => {
    await expect(service.handlePayload(buildPayload({ event: 'something.else' }))).resolves.toBeUndefined();
    expect(prisma.raw.tikTokConnection.findUnique).not.toHaveBeenCalled();
  });

  it('silently skips when no connection matches the business id', async () => {
    prisma.raw.tikTokConnection.findUnique.mockResolvedValue(null);
    await expect(service.handlePayload(buildPayload())).resolves.toBeUndefined();
    expect(tenantContext.setContext).not.toHaveBeenCalled();
  });

  it('sets the tenant context when a connection is found', async () => {
    prisma.raw.tikTokConnection.findUnique.mockResolvedValue({ tenantId: 'tenant-1' });
    prisma.raw.message.findUnique.mockResolvedValue(null);
    prisma.client.contactChannel.findFirst.mockResolvedValue(null);

    await service.handlePayload(buildPayload());

    expect(tenantContext.setContext).toHaveBeenCalledWith({ tenantId: 'tenant-1' });
  });

  it('skips already-processed messages (dedup)', async () => {
    prisma.raw.tikTokConnection.findUnique.mockResolvedValue({ tenantId: 'tenant-1' });
    prisma.raw.message.findUnique.mockResolvedValue({ id: 'existing-msg' });

    await service.handlePayload(buildPayload());

    expect(contactsService.create).not.toHaveBeenCalled();
    expect(conversationsService.create).not.toHaveBeenCalled();
    expect(messagesService.create).not.toHaveBeenCalled();
  });

  it('creates a Contact (no phone) + Conversation for a first-time sender', async () => {
    prisma.raw.tikTokConnection.findUnique.mockResolvedValue({ tenantId: 'tenant-1' });
    prisma.raw.message.findUnique.mockResolvedValue(null);
    prisma.client.contactChannel.findFirst.mockResolvedValue(null);

    await service.handlePayload(buildPayload());

    const createArgs = contactsService.create.mock.calls[0][0];
    expect(createArgs.phone).toBeUndefined();
    expect(createArgs.source).toBe('TIKTOK');
    expect(createArgs.name).toBe('open_abc123');

    expect(conversationsService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        contactId: 'ct1',
        channel: 'TIKTOK',
        externalId: 'open_abc123',
        firstMessageContent: 'Hola desde TikTok',
        firstMessageExternalId: 'ttmsg.TESTID001',
      }),
    );
    expect(messagesService.create).not.toHaveBeenCalled();
  });

  it('appends to the existing open conversation for a repeat sender', async () => {
    prisma.raw.tikTokConnection.findUnique.mockResolvedValue({ tenantId: 'tenant-1' });
    prisma.raw.message.findUnique.mockResolvedValue(null);
    prisma.client.contactChannel.findFirst.mockResolvedValue({ id: 'cc1', contactId: 'ct1' });
    prisma.client.conversation.findFirst.mockResolvedValue({ id: 'conv1', status: 'OPEN' });

    await service.handlePayload(buildPayload());

    expect(messagesService.create).toHaveBeenCalledWith(
      'conv1',
      undefined,
      expect.objectContaining({ direction: 'INBOUND', externalId: 'ttmsg.TESTID001', content: 'Hola desde TikTok' }),
    );
    expect(contactsService.create).not.toHaveBeenCalled();
  });

  it('starts a new conversation when the repeat sender has no open conversation', async () => {
    prisma.raw.tikTokConnection.findUnique.mockResolvedValue({ tenantId: 'tenant-1' });
    prisma.raw.message.findUnique.mockResolvedValue(null);
    prisma.client.contactChannel.findFirst.mockResolvedValue({ id: 'cc1', contactId: 'ct1' });
    prisma.client.conversation.findFirst.mockResolvedValue(null);

    await service.handlePayload(buildPayload());

    expect(conversationsService.create).toHaveBeenCalledWith(
      expect.objectContaining({ contactId: 'ct1', channel: 'TIKTOK' }),
    );
    expect(messagesService.create).not.toHaveBeenCalled();
  });
});
