import { MetaWebhookService } from './meta-webhook.service';

function buildWhatsAppValue(overrides: any = {}) {
  return {
    metadata: { phone_number_id: '1234567890' },
    contacts: [{ profile: { name: 'Juan Perez' } }],
    messages: [{ from: '59178889999', id: 'wamid.TESTID001', text: { body: 'Hola' } }],
    ...overrides,
  };
}

function buildWhatsAppPayload(value: any) {
  return { object: 'whatsapp_business_account', entry: [{ changes: [{ value }] }] };
}

function buildMessagingPayload(object: 'instagram' | 'page', messagingEvent: any) {
  return { object, entry: [{ messaging: [messagingEvent] }] };
}

describe('MetaWebhookService', () => {
  let service: MetaWebhookService;
  let prisma: any;
  let tenantContext: any;
  let contactsService: any;
  let conversationsService: any;
  let messagesService: any;
  let templatesService: any;
  let storageService: any;
  let facebookCommentsService: any;
  const originalFetch = global.fetch;

  beforeEach(() => {
    prisma = {
      raw: {
        metaConnection: { findUnique: jest.fn(), findFirst: jest.fn() },
        message: { findUnique: jest.fn() },
      },
      client: {
        contactChannel: { findFirst: jest.fn() },
        conversation: { findFirst: jest.fn() },
      },
    };
    tenantContext = { setContext: jest.fn(), getTenantId: jest.fn().mockReturnValue('tenant-1') };
    contactsService = { create: jest.fn().mockResolvedValue({ id: 'ct1' }) };
    conversationsService = { create: jest.fn().mockResolvedValue({ id: 'conv1' }) };
    messagesService = { create: jest.fn().mockResolvedValue({ id: 'msg1' }) };
    templatesService = { findByExternalId: jest.fn(), applyStatusUpdate: jest.fn() };
    storageService = { saveAudioBuffer: jest.fn() };
    facebookCommentsService = { handleFeedChange: jest.fn() };

    service = new MetaWebhookService(
      prisma,
      tenantContext,
      contactsService,
      conversationsService,
      messagesService,
      templatesService,
      storageService,
      facebookCommentsService,
    );
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe('unrecognized payload shapes', () => {
    it('no-ops on an unrecognized object type', async () => {
      await expect(service.handlePayload({ object: 'something_else' })).resolves.toBeUndefined();
      expect(prisma.raw.metaConnection.findUnique).not.toHaveBeenCalled();
    });
  });

  describe('WhatsApp (whatsapp_business_account)', () => {
    it('silently skips when no connection matches the phone_number_id, without throwing', async () => {
      prisma.raw.metaConnection.findUnique.mockResolvedValue(null);
      await expect(service.handlePayload(buildWhatsAppPayload(buildWhatsAppValue()))).resolves.toBeUndefined();
      expect(tenantContext.setContext).not.toHaveBeenCalled();
    });

    it('sets the tenant context when a connection is found', async () => {
      prisma.raw.metaConnection.findUnique.mockResolvedValue({ tenantId: 'tenant-1' });
      prisma.raw.message.findUnique.mockResolvedValue(null);
      prisma.client.contactChannel.findFirst.mockResolvedValue(null);

      await service.handlePayload(buildWhatsAppPayload(buildWhatsAppValue()));

      expect(tenantContext.setContext).toHaveBeenCalledWith({ tenantId: 'tenant-1' });
    });

    it('skips already-processed messages (dedup) without calling any create path', async () => {
      prisma.raw.metaConnection.findUnique.mockResolvedValue({ tenantId: 'tenant-1' });
      prisma.raw.message.findUnique.mockResolvedValue({ id: 'existing-msg' });

      await service.handlePayload(buildWhatsAppPayload(buildWhatsAppValue()));

      expect(contactsService.create).not.toHaveBeenCalled();
      expect(conversationsService.create).not.toHaveBeenCalled();
      expect(messagesService.create).not.toHaveBeenCalled();
    });

    it('creates a Contact + Conversation for a first-time sender, with phone set', async () => {
      prisma.raw.metaConnection.findUnique.mockResolvedValue({ tenantId: 'tenant-1' });
      prisma.raw.message.findUnique.mockResolvedValue(null);
      prisma.client.contactChannel.findFirst.mockResolvedValue(null);

      await service.handlePayload(buildWhatsAppPayload(buildWhatsAppValue()));

      expect(contactsService.create).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Juan Perez', phone: '59178889999', source: 'WHATSAPP' }),
      );
      expect(conversationsService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          contactId: 'ct1',
          channel: 'WHATSAPP',
          externalId: '59178889999',
          firstMessageContent: 'Hola',
          firstMessageExternalId: 'wamid.TESTID001',
          isNewContact: true,
          adReferral: undefined,
        }),
      );
      expect(messagesService.create).not.toHaveBeenCalled();
    });

    it('appends to the existing open conversation for a repeat sender', async () => {
      prisma.raw.metaConnection.findUnique.mockResolvedValue({ tenantId: 'tenant-1' });
      prisma.raw.message.findUnique.mockResolvedValue(null);
      prisma.client.contactChannel.findFirst.mockResolvedValue({ id: 'cc1', contactId: 'ct1' });
      prisma.client.conversation.findFirst.mockResolvedValue({ id: 'conv1', status: 'OPEN' });

      await service.handlePayload(buildWhatsAppPayload(buildWhatsAppValue()));

      expect(messagesService.create).toHaveBeenCalledWith(
        'conv1',
        undefined,
        expect.objectContaining({ direction: 'INBOUND', externalId: 'wamid.TESTID001', content: 'Hola' }),
      );
      expect(contactsService.create).not.toHaveBeenCalled();
      expect(conversationsService.create).not.toHaveBeenCalled();
    });

    it('marks isNewContact=false and still forwards adReferral when an existing contact reopens via a new ad', async () => {
      prisma.raw.metaConnection.findUnique.mockResolvedValue({ tenantId: 'tenant-1' });
      prisma.raw.message.findUnique.mockResolvedValue(null);
      prisma.client.contactChannel.findFirst.mockResolvedValue({ id: 'cc1', contactId: 'ct1' });
      prisma.client.conversation.findFirst.mockResolvedValue(null);

      await service.handlePayload(
        buildWhatsAppPayload(
          buildWhatsAppValue({
            messages: [
              {
                from: '59178889999',
                id: 'wamid.TESTID002',
                text: { body: 'Hola' },
                referral: {
                  source_url: 'https://fb.me/ad123',
                  source_type: 'ad',
                  source_id: 'ad123',
                  headline: 'Promo de lanzamiento',
                  body: 'Escríbenos',
                  media_type: 'image',
                  ctwa_clid: 'clid-abc',
                },
              },
            ],
          }),
        ),
      );

      expect(conversationsService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          isNewContact: false,
          adReferral: {
            sourceUrl: 'https://fb.me/ad123',
            sourceType: 'ad',
            sourceId: 'ad123',
            headline: 'Promo de lanzamiento',
            body: 'Escríbenos',
            mediaType: 'image',
            ctwaClid: 'clid-abc',
          },
        }),
      );
    });

    it('does not set adReferral when the message carries none', async () => {
      prisma.raw.metaConnection.findUnique.mockResolvedValue({ tenantId: 'tenant-1' });
      prisma.raw.message.findUnique.mockResolvedValue(null);
      prisma.client.contactChannel.findFirst.mockResolvedValue({ id: 'cc1', contactId: 'ct1' });
      prisma.client.conversation.findFirst.mockResolvedValue(null);

      await service.handlePayload(buildWhatsAppPayload(buildWhatsAppValue()));

      expect(conversationsService.create).toHaveBeenCalledWith(
        expect.objectContaining({ isNewContact: false, adReferral: undefined }),
      );
    });

    it("uses the tapped button's title as the content for a native interactive reply", async () => {
      prisma.raw.metaConnection.findUnique.mockResolvedValue({ tenantId: 'tenant-1' });
      prisma.raw.message.findUnique.mockResolvedValue(null);
      prisma.client.contactChannel.findFirst.mockResolvedValue({ id: 'cc1', contactId: 'ct1' });
      prisma.client.conversation.findFirst.mockResolvedValue({ id: 'conv1', status: 'OPEN' });

      await service.handlePayload(
        buildWhatsAppPayload(
          buildWhatsAppValue({
            messages: [
              {
                from: '59178889999',
                id: 'wamid.BTN001',
                type: 'interactive',
                interactive: { type: 'button_reply', button_reply: { id: 'opt_0', title: 'Retiro' } },
              },
            ],
          }),
        ),
      );

      expect(messagesService.create).toHaveBeenCalledWith(
        'conv1',
        undefined,
        expect.objectContaining({ direction: 'INBOUND', externalId: 'wamid.BTN001', content: 'Retiro' }),
      );
    });

    describe('voice notes (msg.type === "audio")', () => {
      function buildAudioValue(overrides: any = {}) {
        return buildWhatsAppValue({
          messages: [{ from: '59178889999', id: 'wamid.AUDIO001', type: 'audio', audio: { id: 'media-1', mime_type: 'audio/ogg' } }],
          ...overrides,
        });
      }

      beforeEach(() => {
        prisma.client.contactChannel.findFirst.mockResolvedValue({ id: 'cc1', contactId: 'ct1' });
        prisma.client.conversation.findFirst.mockResolvedValue({ id: 'conv1', status: 'OPEN' });
      });

      it('downloads the media (resolve id → URL, then fetch URL), uploads it, and creates an AUDIO message with the attachment', async () => {
        prisma.raw.metaConnection.findUnique.mockResolvedValue({ tenantId: 'tenant-1', accessToken: 'meta-token' });
        prisma.raw.message.findUnique.mockResolvedValue(null);
        global.fetch = jest
          .fn()
          .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ url: 'https://graph.example/cdn/file', mime_type: 'audio/ogg' }) })
          .mockResolvedValueOnce({ ok: true, arrayBuffer: () => Promise.resolve(Buffer.from('raw-audio-bytes')) }) as any;
        storageService.saveAudioBuffer.mockResolvedValue({ url: 'http://api/uploads/audio/tenant-1/x.ogg', mimeType: 'audio/ogg' });

        await service.handlePayload(buildWhatsAppPayload(buildAudioValue()));

        expect(global.fetch).toHaveBeenNthCalledWith(1, 'https://graph.facebook.com/v19.0/media-1', {
          headers: { Authorization: 'Bearer meta-token' },
        });
        expect(global.fetch).toHaveBeenNthCalledWith(2, 'https://graph.example/cdn/file', {
          headers: { Authorization: 'Bearer meta-token' },
        });
        expect(storageService.saveAudioBuffer).toHaveBeenCalledWith('tenant-1', Buffer.from('raw-audio-bytes'), 'audio/ogg');
        expect(messagesService.create).toHaveBeenCalledWith(
          'conv1',
          undefined,
          expect.objectContaining({
            direction: 'INBOUND',
            type: 'AUDIO',
            content: '',
            externalId: 'wamid.AUDIO001',
            attachmentUrl: 'http://api/uploads/audio/tenant-1/x.ogg',
            attachmentMimeType: 'audio/ogg',
            attachmentFileName: 'audio.ogg',
            attachmentSize: 'raw-audio-bytes'.length,
          }),
        );
      });

      it('skips the message (without creating anything) when the media-id lookup fails', async () => {
        prisma.raw.metaConnection.findUnique.mockResolvedValue({ tenantId: 'tenant-1', accessToken: 'meta-token' });
        prisma.raw.message.findUnique.mockResolvedValue(null);
        global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 401 }) as any;

        await service.handlePayload(buildWhatsAppPayload(buildAudioValue()));

        expect(storageService.saveAudioBuffer).not.toHaveBeenCalled();
        expect(messagesService.create).not.toHaveBeenCalled();
      });

      it('skips the message when the CDN file fetch fails after a successful media-id lookup', async () => {
        prisma.raw.metaConnection.findUnique.mockResolvedValue({ tenantId: 'tenant-1', accessToken: 'meta-token' });
        prisma.raw.message.findUnique.mockResolvedValue(null);
        global.fetch = jest
          .fn()
          .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ url: 'https://graph.example/cdn/file', mime_type: 'audio/ogg' }) })
          .mockResolvedValueOnce({ ok: false, status: 500 }) as any;

        await service.handlePayload(buildWhatsAppPayload(buildAudioValue()));

        expect(storageService.saveAudioBuffer).not.toHaveBeenCalled();
        expect(messagesService.create).not.toHaveBeenCalled();
      });
    });

    it('starts a new conversation when the repeat sender has no open conversation', async () => {
      prisma.raw.metaConnection.findUnique.mockResolvedValue({ tenantId: 'tenant-1' });
      prisma.raw.message.findUnique.mockResolvedValue(null);
      prisma.client.contactChannel.findFirst.mockResolvedValue({ id: 'cc1', contactId: 'ct1' });
      prisma.client.conversation.findFirst.mockResolvedValue(null);

      await service.handlePayload(buildWhatsAppPayload(buildWhatsAppValue()));

      expect(conversationsService.create).toHaveBeenCalledWith(
        expect.objectContaining({ contactId: 'ct1', channel: 'WHATSAPP' }),
      );
      expect(messagesService.create).not.toHaveBeenCalled();
    });
  });

  describe.each([
    { object: 'instagram' as const, expectedChannel: 'INSTAGRAM' },
    { object: 'page' as const, expectedChannel: 'MESSENGER' },
  ])('$object (flat messaging[])', ({ object, expectedChannel }) => {
    function buildEvent(overrides: any = {}) {
      return {
        sender: { id: 'psid-123' },
        recipient: { id: 'recipient-abc' },
        message: { mid: 'mid.TESTID001', text: 'Hola desde DM' },
        ...overrides,
      };
    }

    it('silently skips when no connection matches the recipient id', async () => {
      prisma.raw.metaConnection.findUnique.mockResolvedValue(null);
      await expect(
        service.handlePayload(buildMessagingPayload(object, buildEvent())),
      ).resolves.toBeUndefined();
      expect(tenantContext.setContext).not.toHaveBeenCalled();
    });

    it('resolves the connection by channel + recipient id', async () => {
      prisma.raw.metaConnection.findUnique.mockResolvedValue({ tenantId: 'tenant-1' });
      prisma.raw.message.findUnique.mockResolvedValue(null);
      prisma.client.contactChannel.findFirst.mockResolvedValue(null);

      await service.handlePayload(buildMessagingPayload(object, buildEvent()));

      expect(prisma.raw.metaConnection.findUnique).toHaveBeenCalledWith({
        where: { channel_externalAccountId: { channel: expectedChannel, externalAccountId: 'recipient-abc' } },
      });
      expect(tenantContext.setContext).toHaveBeenCalledWith({ tenantId: 'tenant-1' });
    });

    it('ignores messaging events without message.text (reactions, read receipts, etc.)', async () => {
      prisma.raw.metaConnection.findUnique.mockResolvedValue({ tenantId: 'tenant-1' });

      await service.handlePayload(
        buildMessagingPayload(object, buildEvent({ message: undefined, read: { mid: 'mid.TESTID001' } })),
      );

      expect(prisma.raw.message.findUnique).not.toHaveBeenCalled();
      expect(contactsService.create).not.toHaveBeenCalled();
      expect(messagesService.create).not.toHaveBeenCalled();
    });

    it('skips already-processed messages (dedup)', async () => {
      prisma.raw.metaConnection.findUnique.mockResolvedValue({ tenantId: 'tenant-1' });
      prisma.raw.message.findUnique.mockResolvedValue({ id: 'existing-msg' });

      await service.handlePayload(buildMessagingPayload(object, buildEvent()));

      expect(contactsService.create).not.toHaveBeenCalled();
      expect(conversationsService.create).not.toHaveBeenCalled();
      expect(messagesService.create).not.toHaveBeenCalled();
    });

    it('creates a Contact (no phone) + Conversation for a first-time sender', async () => {
      prisma.raw.metaConnection.findUnique.mockResolvedValue({ tenantId: 'tenant-1' });
      prisma.raw.message.findUnique.mockResolvedValue(null);
      prisma.client.contactChannel.findFirst.mockResolvedValue(null);

      await service.handlePayload(buildMessagingPayload(object, buildEvent()));

      const createArgs = contactsService.create.mock.calls[0][0];
      expect(createArgs.phone).toBeUndefined();
      expect(createArgs.source).toBe(expectedChannel);
      expect(createArgs.name).toBe('psid-123');

      expect(conversationsService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          contactId: 'ct1',
          channel: expectedChannel,
          externalId: 'psid-123',
          firstMessageContent: 'Hola desde DM',
          firstMessageExternalId: 'mid.TESTID001',
        }),
      );
    });

    it('appends to the existing open conversation for a repeat sender', async () => {
      prisma.raw.metaConnection.findUnique.mockResolvedValue({ tenantId: 'tenant-1' });
      prisma.raw.message.findUnique.mockResolvedValue(null);
      prisma.client.contactChannel.findFirst.mockResolvedValue({ id: 'cc1', contactId: 'ct1' });
      prisma.client.conversation.findFirst.mockResolvedValue({ id: 'conv1', status: 'OPEN' });

      await service.handlePayload(buildMessagingPayload(object, buildEvent()));

      expect(messagesService.create).toHaveBeenCalledWith(
        'conv1',
        undefined,
        expect.objectContaining({ direction: 'INBOUND', externalId: 'mid.TESTID001', content: 'Hola desde DM' }),
      );
      expect(contactsService.create).not.toHaveBeenCalled();
    });
  });

  describe('Facebook Page comments (object: "page", entry.changes field "feed")', () => {
    function buildFeedPayload(value: any, entryId = 'page-1') {
      return { object: 'page', entry: [{ id: entryId, changes: [{ field: 'feed', value }] }] };
    }

    it('routes a feed/comment change to FacebookCommentsService.handleFeedChange with the entry id as pageId', async () => {
      const value = { item: 'comment', verb: 'add', comment_id: 'x' };
      await service.handlePayload(buildFeedPayload(value, 'page-42'));
      expect(facebookCommentsService.handleFeedChange).toHaveBeenCalledWith('page-42', value);
    });

    it('ignores changes fields other than "feed"', async () => {
      await service.handlePayload({ object: 'page', entry: [{ id: 'page-1', changes: [{ field: 'ratings', value: {} }] }] });
      expect(facebookCommentsService.handleFeedChange).not.toHaveBeenCalled();
    });

    it('does not let a failure in comment handling break messaging events on the same entry', async () => {
      facebookCommentsService.handleFeedChange.mockRejectedValue(new Error('boom'));
      prisma.raw.metaConnection.findUnique.mockResolvedValue({ tenantId: 'tenant-1' });
      prisma.raw.message.findUnique.mockResolvedValue(null);
      prisma.client.contactChannel.findFirst.mockResolvedValue({ id: 'cc1', contactId: 'ct1' });
      prisma.client.conversation.findFirst.mockResolvedValue({ id: 'conv1', status: 'OPEN' });

      const payload = {
        object: 'page',
        entry: [
          {
            id: 'page-1',
            messaging: [{ sender: { id: 'psid-123' }, recipient: { id: 'page-1' }, message: { mid: 'mid.1', text: 'Hola' } }],
            changes: [{ field: 'feed', value: { item: 'comment', verb: 'add', comment_id: 'x' } }],
          },
        ],
      };

      await expect(service.handlePayload(payload)).resolves.toBeUndefined();
      expect(messagesService.create).toHaveBeenCalled();
    });

    it('does not process entry.changes at all for object: "instagram" (Instagram comments are out of scope)', async () => {
      await service.handlePayload({
        object: 'instagram',
        entry: [{ id: 'ig-1', changes: [{ field: 'feed', value: { item: 'comment', verb: 'add' } }] }],
      });
      expect(facebookCommentsService.handleFeedChange).not.toHaveBeenCalled();
    });
  });

  describe('message_template_status_update', () => {
    function buildTemplateStatusPayload(value: any, wabaId = 'waba-1') {
      return {
        object: 'whatsapp_business_account',
        entry: [{ id: wabaId, changes: [{ field: 'message_template_status_update', value }] }],
      };
    }

    it('no-ops when the WABA id has no connected tenant', async () => {
      prisma.raw.metaConnection.findFirst.mockResolvedValue(null);
      await service.handlePayload(buildTemplateStatusPayload({ event: 'APPROVED', message_template_id: 1 }));
      expect(templatesService.findByExternalId).not.toHaveBeenCalled();
    });

    it('no-ops when the template id is unknown to this tenant', async () => {
      prisma.raw.metaConnection.findFirst.mockResolvedValue({ tenantId: 'tenant-1' });
      templatesService.findByExternalId.mockResolvedValue(null);
      await service.handlePayload(buildTemplateStatusPayload({ event: 'APPROVED', message_template_id: 999 }));
      expect(templatesService.applyStatusUpdate).not.toHaveBeenCalled();
    });

    it('applies the status update for a known template, scoped to the resolved tenant', async () => {
      prisma.raw.metaConnection.findFirst.mockResolvedValue({ tenantId: 'tenant-1' });
      templatesService.findByExternalId.mockResolvedValue({ id: 'tpl-1' });

      await service.handlePayload(
        buildTemplateStatusPayload({ event: 'REJECTED', message_template_id: 42, reason: 'INVALID_FORMAT' }),
      );

      expect(prisma.raw.metaConnection.findFirst).toHaveBeenCalledWith({
        where: { channel: 'WHATSAPP', wabaId: 'waba-1' },
      });
      expect(templatesService.findByExternalId).toHaveBeenCalledWith('tenant-1', '42');
      expect(tenantContext.setContext).toHaveBeenCalledWith({ tenantId: 'tenant-1' });
      expect(templatesService.applyStatusUpdate).toHaveBeenCalledWith('tpl-1', 'REJECTED', 'INVALID_FORMAT');
    });

    it('does not affect ordinary message-field changes routed alongside it', async () => {
      prisma.raw.metaConnection.findUnique.mockResolvedValue(null);
      const payload = {
        object: 'whatsapp_business_account',
        entry: [{ id: 'waba-1', changes: [{ field: 'messages', value: buildWhatsAppValue() }] }],
      };
      await service.handlePayload(payload);
      expect(templatesService.findByExternalId).not.toHaveBeenCalled();
    });
  });
});
