import { AiReplyService } from './ai-reply.service';

describe('AiReplyService', () => {
  let service: AiReplyService;
  let prisma: any;
  let tenantContext: any;
  let messagesService: any;
  let openAiAdapter: any;
  let anthropicAdapter: any;
  let geminiAdapter: any;
  let deepSeekAdapter: any;
  let knowledgeSearchService: any;
  let contactCommerceService: any;
  let aiCredentialsService: any;
  let aiToolsService: any;

  const openAgent = (overrides: any = {}) => ({
    id: 'agent-1',
    temperature: 0.7,
    maxTokens: 500,
    language: 'es',
    goal: null,
    personality: null,
    escalationKeywords: [],
    model: { name: 'gpt-4o-mini', providerId: 'p-openai', provider: { type: 'OPENAI' } },
    ...overrides,
  });

  beforeEach(() => {
    prisma = {
      client: {
        conversation: { findUnique: jest.fn() },
        aiAgent: { findMany: jest.fn().mockResolvedValue([]) },
        message: { findUnique: jest.fn(), findMany: jest.fn().mockResolvedValue([]) },
        aiUsage: { create: jest.fn() },
        ecommerceStore: { findUnique: jest.fn() },
      },
    };
    tenantContext = { setContext: jest.fn() };
    messagesService = { create: jest.fn(), sendQuickReplies: jest.fn(), sendForm: jest.fn() };
    openAiAdapter = { complete: jest.fn() };
    anthropicAdapter = { complete: jest.fn() };
    geminiAdapter = { complete: jest.fn() };
    deepSeekAdapter = { complete: jest.fn() };
    knowledgeSearchService = { search: jest.fn().mockResolvedValue([]) };
    contactCommerceService = { generateStorefrontLink: jest.fn() };
    aiCredentialsService = { getDecrypted: jest.fn().mockResolvedValue('sk-test') };
    aiToolsService = { execute: jest.fn() };
    service = new AiReplyService(
      prisma,
      tenantContext,
      messagesService,
      openAiAdapter,
      anthropicAdapter,
      geminiAdapter,
      deepSeekAdapter,
      knowledgeSearchService,
      contactCommerceService,
      aiCredentialsService,
      aiToolsService,
    );
  });

  it('sets tenant context before doing anything else', async () => {
    prisma.client.conversation.findUnique.mockResolvedValue(null);
    await service.generateReply('t1', 'conv1', 'msg1');
    expect(tenantContext.setContext).toHaveBeenCalledWith({ tenantId: 't1' });
  });

  it('no-ops when the conversation does not exist', async () => {
    prisma.client.conversation.findUnique.mockResolvedValue(null);
    await service.generateReply('t1', 'conv1', 'msg1');
    expect(openAiAdapter.complete).not.toHaveBeenCalled();
  });

  it('no-ops when a human already owns the conversation', async () => {
    prisma.client.conversation.findUnique.mockResolvedValue({ id: 'conv1', assignedToId: 'user-1', status: 'OPEN', channel: 'WHATSAPP' });
    await service.generateReply('t1', 'conv1', 'msg1');
    expect(prisma.client.aiAgent.findMany).not.toHaveBeenCalled();
  });

  it('no-ops when the conversation is closed', async () => {
    prisma.client.conversation.findUnique.mockResolvedValue({ id: 'conv1', assignedToId: null, status: 'CLOSED', channel: 'WHATSAPP' });
    await service.generateReply('t1', 'conv1', 'msg1');
    expect(prisma.client.aiAgent.findMany).not.toHaveBeenCalled();
  });

  it('no-ops when there is no ACTIVE agent for the channel', async () => {
    prisma.client.conversation.findUnique.mockResolvedValue({ id: 'conv1', assignedToId: null, status: 'OPEN', channel: 'WHATSAPP' });
    prisma.client.aiAgent.findMany.mockResolvedValue([]);
    await service.generateReply('t1', 'conv1', 'msg1');
    expect(openAiAdapter.complete).not.toHaveBeenCalled();
  });

  it('no-ops when more than one ACTIVE agent claims the channel (ambiguous, never guesses)', async () => {
    prisma.client.conversation.findUnique.mockResolvedValue({ id: 'conv1', assignedToId: null, status: 'OPEN', channel: 'WHATSAPP' });
    prisma.client.aiAgent.findMany.mockResolvedValue([openAgent(), openAgent({ id: 'agent-2' })]);
    await service.generateReply('t1', 'conv1', 'msg1');
    expect(openAiAdapter.complete).not.toHaveBeenCalled();
  });

  describe.each([
    ['OPENAI', 'openAiAdapter'],
    ['ANTHROPIC', 'anthropicAdapter'],
    ['GEMINI', 'geminiAdapter'],
    ['DEEPSEEK', 'deepSeekAdapter'],
  ] as const)('provider %s', (providerType, adapterName) => {
    const adaptersByName: Record<string, () => any> = {
      openAiAdapter: () => openAiAdapter,
      anthropicAdapter: () => anthropicAdapter,
      geminiAdapter: () => geminiAdapter,
      deepSeekAdapter: () => deepSeekAdapter,
    };

    it(`dispatches to the ${adapterName} and only that one`, async () => {
      const matchingAdapter = adaptersByName[adapterName]();
      const otherAdapters = Object.entries(adaptersByName)
        .filter(([name]) => name !== adapterName)
        .map(([, get]) => get());

      prisma.client.conversation.findUnique.mockResolvedValue({ id: 'conv1', assignedToId: null, status: 'OPEN', channel: 'WHATSAPP' });
      prisma.client.aiAgent.findMany.mockResolvedValue([
        openAgent({ model: { name: 'some-model', providerId: 'p-1', provider: { type: providerType } } }),
      ]);
      prisma.client.message.findUnique.mockResolvedValue({ id: 'msg1', direction: 'INBOUND', content: 'hola' });
      matchingAdapter.complete.mockResolvedValue({ content: 'respuesta', promptTokens: 1, completionTokens: 1 });

      await service.generateReply('t1', 'conv1', 'msg1');

      expect(matchingAdapter.complete).toHaveBeenCalledTimes(1);
      otherAdapters.forEach((adapter) => expect(adapter.complete).not.toHaveBeenCalled());
    });
  });

  it('no-ops when the tenant has no credential configured for the agent\'s provider (no platform fallback key)', async () => {
    prisma.client.conversation.findUnique.mockResolvedValue({ id: 'conv1', assignedToId: null, status: 'OPEN', channel: 'WHATSAPP' });
    prisma.client.aiAgent.findMany.mockResolvedValue([openAgent()]);
    aiCredentialsService.getDecrypted.mockResolvedValue(null);

    await service.generateReply('t1', 'conv1', 'msg1');

    expect(aiCredentialsService.getDecrypted).toHaveBeenCalledWith('t1', 'p-openai');
    expect(openAiAdapter.complete).not.toHaveBeenCalled();
  });

  it('no-ops when the triggering message is not INBOUND', async () => {
    prisma.client.conversation.findUnique.mockResolvedValue({ id: 'conv1', assignedToId: null, status: 'OPEN', channel: 'WHATSAPP' });
    prisma.client.aiAgent.findMany.mockResolvedValue([openAgent()]);
    prisma.client.message.findUnique.mockResolvedValue({ id: 'msg1', direction: 'OUTBOUND', content: 'hola' });
    await service.generateReply('t1', 'conv1', 'msg1');
    expect(openAiAdapter.complete).not.toHaveBeenCalled();
  });

  it('skips the reply when the message matches an escalation keyword, case-insensitively', async () => {
    prisma.client.conversation.findUnique.mockResolvedValue({ id: 'conv1', assignedToId: null, status: 'OPEN', channel: 'WHATSAPP' });
    prisma.client.aiAgent.findMany.mockResolvedValue([openAgent({ escalationKeywords: ['reembolso'] })]);
    prisma.client.message.findUnique.mockResolvedValue({ id: 'msg1', direction: 'INBOUND', content: 'Quiero un REEMBOLSO ya' });
    await service.generateReply('t1', 'conv1', 'msg1');
    expect(openAiAdapter.complete).not.toHaveBeenCalled();
  });

  it('builds chat history oldest-first, mapping INBOUND to user and OUTBOUND to assistant, then sends the reply', async () => {
    prisma.client.conversation.findUnique.mockResolvedValue({
      id: 'conv1',
      assignedToId: null,
      status: 'OPEN',
      channel: 'WHATSAPP',
      contact: { id: 'c1', name: 'Ana' },
    });
    prisma.client.aiAgent.findMany.mockResolvedValue([openAgent()]);
    prisma.client.message.findUnique.mockResolvedValue({ id: 'msg2', direction: 'INBOUND', content: '¿Tienen delivery?' });
    // findMany returns newest-first, as the real query does (orderBy desc)
    prisma.client.message.findMany.mockResolvedValue([
      { direction: 'INBOUND', content: '¿Tienen delivery?' },
      { direction: 'OUTBOUND', content: 'Hola, bienvenido' },
      { direction: 'INBOUND', content: 'Hola' },
    ]);
    openAiAdapter.complete.mockResolvedValue({ content: 'Sí, hacemos delivery', promptTokens: 40, completionTokens: 8 });

    await service.generateReply('t1', 'conv1', 'msg2');

    expect(openAiAdapter.complete).toHaveBeenCalledWith(
      expect.objectContaining({
        apiKey: 'sk-test',
        model: 'gpt-4o-mini',
        temperature: 0.7,
        maxTokens: 500,
        messages: [
          expect.objectContaining({ role: 'system' }),
          { role: 'user', content: 'Hola' },
          { role: 'assistant', content: 'Hola, bienvenido' },
          { role: 'user', content: '¿Tienen delivery?' },
        ],
      }),
    );
    expect(prisma.client.aiUsage.create).toHaveBeenCalledWith({
      data: { agentId: 'agent-1', conversationId: 'conv1', promptTokens: 40, completionTokens: 8, totalTokens: 48 },
    });
    expect(messagesService.create).toHaveBeenCalledWith('conv1', 'agent-1', {
      direction: 'OUTBOUND',
      type: 'TEXT',
      content: 'Sí, hacemos delivery',
    });
  });

  it('queries the knowledge base with the agent id and the triggering message, injecting matches into the system prompt', async () => {
    prisma.client.conversation.findUnique.mockResolvedValue({ id: 'conv1', assignedToId: null, status: 'OPEN', channel: 'WHATSAPP' });
    prisma.client.aiAgent.findMany.mockResolvedValue([openAgent()]);
    prisma.client.message.findUnique.mockResolvedValue({ id: 'msg1', direction: 'INBOUND', content: '¿Cuál es el horario de atención?' });
    knowledgeSearchService.search.mockResolvedValue(['Atendemos de lunes a sábado, 9am a 7pm.']);
    openAiAdapter.complete.mockResolvedValue({ content: 'Atendemos de 9am a 7pm', promptTokens: 20, completionTokens: 6 });

    await service.generateReply('t1', 'conv1', 'msg1');

    expect(knowledgeSearchService.search).toHaveBeenCalledWith('agent-1', '¿Cuál es el horario de atención?');
    const [[callArgs]] = openAiAdapter.complete.mock.calls;
    const systemMessage = callArgs.messages.find((m: any) => m.role === 'system');
    expect(systemMessage.content).toContain('Atendemos de lunes a sábado, 9am a 7pm.');
  });

  it('skips recording usage and sending a message when the completion content is empty', async () => {
    prisma.client.conversation.findUnique.mockResolvedValue({ id: 'conv1', assignedToId: null, status: 'OPEN', channel: 'WHATSAPP' });
    prisma.client.aiAgent.findMany.mockResolvedValue([openAgent()]);
    prisma.client.message.findUnique.mockResolvedValue({ id: 'msg1', direction: 'INBOUND', content: 'hola' });
    openAiAdapter.complete.mockResolvedValue({ content: '   ', promptTokens: 10, completionTokens: 0 });

    await service.generateReply('t1', 'conv1', 'msg1');

    expect(prisma.client.aiUsage.create).not.toHaveBeenCalled();
    expect(messagesService.create).not.toHaveBeenCalled();
  });

  describe('send_storefront_link tool', () => {
    const baseConversation = { id: 'conv1', assignedToId: null, status: 'OPEN', channel: 'WHATSAPP', contactId: 'contact-1' };

    it('does not offer the tool when the store is not PUBLISHED', async () => {
      prisma.client.conversation.findUnique.mockResolvedValue(baseConversation);
      prisma.client.aiAgent.findMany.mockResolvedValue([openAgent()]);
      prisma.client.message.findUnique.mockResolvedValue({ id: 'msg1', direction: 'INBOUND', content: 'quiero comprar' });
      prisma.client.ecommerceStore.findUnique.mockResolvedValue({ status: 'DRAFT', operationMode: 'BOTH' });
      openAiAdapter.complete.mockResolvedValue({ content: 'Hola', promptTokens: 5, completionTokens: 2 });

      await service.generateReply('t1', 'conv1', 'msg1');

      const [[callArgs]] = openAiAdapter.complete.mock.calls;
      expect(callArgs.tools).toBeUndefined();
    });

    it('narrows the allowed action to STORE when operationMode is DIRECT_SALE', async () => {
      prisma.client.conversation.findUnique.mockResolvedValue(baseConversation);
      prisma.client.aiAgent.findMany.mockResolvedValue([openAgent()]);
      prisma.client.message.findUnique.mockResolvedValue({ id: 'msg1', direction: 'INBOUND', content: 'quiero comprar' });
      prisma.client.ecommerceStore.findUnique.mockResolvedValue({ status: 'PUBLISHED', operationMode: 'DIRECT_SALE' });
      openAiAdapter.complete.mockResolvedValue({ content: 'Hola', promptTokens: 5, completionTokens: 2 });

      await service.generateReply('t1', 'conv1', 'msg1');

      const [[callArgs]] = openAiAdapter.complete.mock.calls;
      expect(callArgs.tools[0].parameters.properties.action.enum).toEqual(['STORE']);
    });

    it('generates a real link for the conversation\'s own contactId and creates a CTA message, never a TEXT one, in the same turn', async () => {
      prisma.client.conversation.findUnique.mockResolvedValue(baseConversation);
      prisma.client.aiAgent.findMany.mockResolvedValue([openAgent()]);
      prisma.client.message.findUnique.mockResolvedValue({ id: 'msg1', direction: 'INBOUND', content: 'quiero comprar' });
      prisma.client.ecommerceStore.findUnique.mockResolvedValue({ status: 'PUBLISHED', operationMode: 'BOTH' });
      openAiAdapter.complete.mockResolvedValue({
        content: '',
        promptTokens: 30,
        completionTokens: 5,
        toolCalls: [{ name: 'send_storefront_link', arguments: JSON.stringify({ action: 'STORE', message: 'Mirá nuestro catálogo' }) }],
      });
      contactCommerceService.generateStorefrontLink.mockResolvedValue({ url: 'http://localhost:3000/tienda/demo?s=abc123' });

      await service.generateReply('t1', 'conv1', 'msg1');

      expect(contactCommerceService.generateStorefrontLink).toHaveBeenCalledWith('contact-1');
      expect(messagesService.create).toHaveBeenCalledTimes(1);
      expect(messagesService.create).toHaveBeenCalledWith('conv1', 'agent-1', {
        direction: 'OUTBOUND',
        type: 'CTA',
        content: 'Mirá nuestro catálogo\n\nhttp://localhost:3000/tienda/demo?s=abc123',
        ctaPayload: { action: 'STORE', url: 'http://localhost:3000/tienda/demo?s=abc123', label: 'Ir a la tienda' },
      });
      expect(prisma.client.aiUsage.create).toHaveBeenCalledWith({
        data: { agentId: 'agent-1', conversationId: 'conv1', promptTokens: 30, completionTokens: 5, totalTokens: 35 },
      });
    });

    it('derives the booking URL by inserting /reservas when action is BOOKING', async () => {
      prisma.client.conversation.findUnique.mockResolvedValue(baseConversation);
      prisma.client.aiAgent.findMany.mockResolvedValue([openAgent()]);
      prisma.client.message.findUnique.mockResolvedValue({ id: 'msg1', direction: 'INBOUND', content: 'quiero agendar' });
      prisma.client.ecommerceStore.findUnique.mockResolvedValue({ status: 'PUBLISHED', operationMode: 'BOTH' });
      openAiAdapter.complete.mockResolvedValue({
        content: '',
        promptTokens: 30,
        completionTokens: 5,
        toolCalls: [{ name: 'send_storefront_link', arguments: JSON.stringify({ action: 'BOOKING', message: 'Elegí un horario' }) }],
      });
      contactCommerceService.generateStorefrontLink.mockResolvedValue({ url: 'http://localhost:3000/tienda/demo?s=abc123' });

      await service.generateReply('t1', 'conv1', 'msg1');

      expect(messagesService.create).toHaveBeenCalledWith('conv1', 'agent-1', {
        direction: 'OUTBOUND',
        type: 'CTA',
        content: 'Elegí un horario\n\nhttp://localhost:3000/tienda/demo/reservas?s=abc123',
        ctaPayload: { action: 'BOOKING', url: 'http://localhost:3000/tienda/demo/reservas?s=abc123', label: 'Reservar cita' },
      });
    });

    it('rejects a tool call for an action the store does not support, even if the model hallucinates it', async () => {
      prisma.client.conversation.findUnique.mockResolvedValue(baseConversation);
      prisma.client.aiAgent.findMany.mockResolvedValue([openAgent()]);
      prisma.client.message.findUnique.mockResolvedValue({ id: 'msg1', direction: 'INBOUND', content: 'quiero agendar' });
      prisma.client.ecommerceStore.findUnique.mockResolvedValue({ status: 'PUBLISHED', operationMode: 'DIRECT_SALE' });
      openAiAdapter.complete.mockResolvedValue({
        content: '',
        promptTokens: 30,
        completionTokens: 5,
        toolCalls: [{ name: 'send_storefront_link', arguments: JSON.stringify({ action: 'BOOKING', message: 'Elegí un horario' }) }],
      });

      await service.generateReply('t1', 'conv1', 'msg1');

      expect(contactCommerceService.generateStorefrontLink).not.toHaveBeenCalled();
      expect(messagesService.create).not.toHaveBeenCalled();
      expect(prisma.client.aiUsage.create).not.toHaveBeenCalled();
    });
  });

  describe('send_quick_replies / send_form tools', () => {
    const baseConversation = { id: 'conv1', assignedToId: null, status: 'OPEN', channel: 'WEBCHAT', contactId: 'contact-1' };

    it('sends quick replies when the tool is enabled for the agent', async () => {
      prisma.client.conversation.findUnique.mockResolvedValue(baseConversation);
      prisma.client.aiAgent.findMany.mockResolvedValue([openAgent({ enabledTools: ['send_quick_replies'] })]);
      prisma.client.message.findUnique.mockResolvedValue({ id: 'msg1', direction: 'INBOUND', content: 'quiero comprar' });
      openAiAdapter.complete.mockResolvedValue({
        content: '',
        promptTokens: 10,
        completionTokens: 4,
        toolCalls: [{ name: 'send_quick_replies', arguments: JSON.stringify({ message: '¿Retiro o envío?', options: ['Retiro', 'Envío'] }) }],
      });

      await service.generateReply('t1', 'conv1', 'msg1');

      expect(messagesService.sendQuickReplies).toHaveBeenCalledWith('conv1', 'agent-1', {
        message: '¿Retiro o envío?',
        options: ['Retiro', 'Envío'],
      });
      expect(prisma.client.aiUsage.create).toHaveBeenCalledWith({
        data: { agentId: 'agent-1', conversationId: 'conv1', promptTokens: 10, completionTokens: 4, totalTokens: 14 },
      });
    });

    it('rejects send_quick_replies when the tool is not enabled for the agent', async () => {
      prisma.client.conversation.findUnique.mockResolvedValue(baseConversation);
      prisma.client.aiAgent.findMany.mockResolvedValue([openAgent({ enabledTools: [] })]);
      prisma.client.message.findUnique.mockResolvedValue({ id: 'msg1', direction: 'INBOUND', content: 'quiero comprar' });
      openAiAdapter.complete.mockResolvedValue({
        content: '',
        promptTokens: 10,
        completionTokens: 4,
        toolCalls: [{ name: 'send_quick_replies', arguments: JSON.stringify({ message: '¿Retiro o envío?', options: ['Retiro', 'Envío'] }) }],
      });

      await service.generateReply('t1', 'conv1', 'msg1');

      expect(messagesService.sendQuickReplies).not.toHaveBeenCalled();
    });

    it('rejects send_quick_replies with fewer than 2 or more than 3 options', async () => {
      prisma.client.conversation.findUnique.mockResolvedValue(baseConversation);
      prisma.client.aiAgent.findMany.mockResolvedValue([openAgent({ enabledTools: ['send_quick_replies'] })]);
      prisma.client.message.findUnique.mockResolvedValue({ id: 'msg1', direction: 'INBOUND', content: 'hola' });
      openAiAdapter.complete.mockResolvedValue({
        content: '',
        promptTokens: 10,
        completionTokens: 4,
        toolCalls: [{ name: 'send_quick_replies', arguments: JSON.stringify({ message: 'Elegí', options: ['Solo una'] }) }],
      });

      await service.generateReply('t1', 'conv1', 'msg1');

      expect(messagesService.sendQuickReplies).not.toHaveBeenCalled();
    });

    it('sends a form when the channel is WEBCHAT and the tool is enabled', async () => {
      prisma.client.conversation.findUnique.mockResolvedValue(baseConversation);
      prisma.client.aiAgent.findMany.mockResolvedValue([openAgent({ enabledTools: ['send_form'] })]);
      prisma.client.message.findUnique.mockResolvedValue({ id: 'msg1', direction: 'INBOUND', content: 'quiero una cita' });
      openAiAdapter.complete.mockResolvedValue({
        content: '',
        promptTokens: 10,
        completionTokens: 4,
        toolCalls: [{
          name: 'send_form',
          arguments: JSON.stringify({ message: 'Completa tus datos', fields: [{ label: 'Nombre', fieldType: 'text' }] }),
        }],
      });

      await service.generateReply('t1', 'conv1', 'msg1');

      expect(messagesService.sendForm).toHaveBeenCalledWith('conv1', 'agent-1', {
        message: 'Completa tus datos',
        fields: [{ label: 'Nombre', fieldType: 'text' }],
        submitLabel: undefined,
      });
    });

    it('rejects send_form on a non-WEBCHAT conversation, even if the tool is enabled', async () => {
      prisma.client.conversation.findUnique.mockResolvedValue({ ...baseConversation, channel: 'WHATSAPP' });
      prisma.client.aiAgent.findMany.mockResolvedValue([openAgent({ enabledTools: ['send_form'] })]);
      prisma.client.message.findUnique.mockResolvedValue({ id: 'msg1', direction: 'INBOUND', content: 'quiero una cita' });
      openAiAdapter.complete.mockResolvedValue({
        content: '',
        promptTokens: 10,
        completionTokens: 4,
        toolCalls: [{
          name: 'send_form',
          arguments: JSON.stringify({ message: 'Completa tus datos', fields: [{ label: 'Nombre', fieldType: 'text' }] }),
        }],
      });

      await service.generateReply('t1', 'conv1', 'msg1');

      expect(messagesService.sendForm).not.toHaveBeenCalled();
    });
  });

  describe('Phase 14: ecommerce/booking data tools', () => {
    const baseConversation = { id: 'conv1', assignedToId: null, status: 'OPEN', channel: 'WHATSAPP', contactId: 'contact-1' };

    it("only offers the agent's enabledTools to the model, in the canonical LlmTool shape", async () => {
      prisma.client.conversation.findUnique.mockResolvedValue(baseConversation);
      prisma.client.aiAgent.findMany.mockResolvedValue([openAgent({ enabledTools: ['check_stock'] })]);
      prisma.client.message.findUnique.mockResolvedValue({ id: 'msg1', direction: 'INBOUND', content: 'hola' });
      openAiAdapter.complete.mockResolvedValue({ content: 'Hola', promptTokens: 5, completionTokens: 2 });

      await service.generateReply('t1', 'conv1', 'msg1');

      const [[callArgs]] = openAiAdapter.complete.mock.calls;
      expect(callArgs.tools).toEqual([expect.objectContaining({ name: 'check_stock' })]);
    });

    it('executes a requested tool, feeds the JSON result back as a tool message, and sends the final reply', async () => {
      prisma.client.conversation.findUnique.mockResolvedValue(baseConversation);
      prisma.client.aiAgent.findMany.mockResolvedValue([openAgent({ enabledTools: ['check_stock'] })]);
      prisma.client.message.findUnique.mockResolvedValue({ id: 'msg1', direction: 'INBOUND', content: '¿hay stock?' });
      openAiAdapter.complete
        .mockResolvedValueOnce({
          content: '',
          promptTokens: 10,
          completionTokens: 5,
          toolCalls: [{ id: 'call_1', name: 'check_stock', arguments: '{"variantId":"v1"}' }],
        })
        .mockResolvedValueOnce({ content: 'Sí, tenemos 3 en stock.', promptTokens: 20, completionTokens: 8 });
      aiToolsService.execute.mockResolvedValue({ ok: true, data: { available: true, stock: 3 } });

      await service.generateReply('t1', 'conv1', 'msg1');

      expect(aiToolsService.execute).toHaveBeenCalledWith('check_stock', '{"variantId":"v1"}', {
        tenantId: 't1',
        contactId: 'contact-1',
        conversationId: 'conv1',
        agentId: 'agent-1',
      });

      const [, secondCallArgs] = openAiAdapter.complete.mock.calls;
      const toolMessage = secondCallArgs[0].messages.find((m: any) => m.role === 'tool');
      expect(toolMessage).toEqual({
        role: 'tool',
        toolCallId: 'call_1',
        toolName: 'check_stock',
        content: JSON.stringify({ ok: true, data: { available: true, stock: 3 } }),
      });

      expect(messagesService.create).toHaveBeenCalledWith('conv1', 'agent-1', {
        direction: 'OUTBOUND',
        type: 'TEXT',
        content: 'Sí, tenemos 3 en stock.',
      });
      // Usage accumulates across both LLM calls in the loop.
      expect(prisma.client.aiUsage.create).toHaveBeenCalledWith({
        data: { agentId: 'agent-1', conversationId: 'conv1', promptTokens: 30, completionTokens: 13, totalTokens: 43 },
      });
    });

    it('rejects and never executes a tool call for a tool not in enabledTools, even if the model calls it anyway', async () => {
      prisma.client.conversation.findUnique.mockResolvedValue(baseConversation);
      prisma.client.aiAgent.findMany.mockResolvedValue([openAgent({ enabledTools: ['check_stock'] })]);
      prisma.client.message.findUnique.mockResolvedValue({ id: 'msg1', direction: 'INBOUND', content: 'cancela mi pedido' });
      openAiAdapter.complete
        .mockResolvedValueOnce({
          content: '',
          promptTokens: 10,
          completionTokens: 5,
          toolCalls: [{ id: 'call_1', name: 'cancel_order', arguments: '{"orderNumber":"ORD-1"}' }],
        })
        .mockResolvedValueOnce({ content: 'No puedo hacer eso.', promptTokens: 15, completionTokens: 6 });

      await service.generateReply('t1', 'conv1', 'msg1');

      expect(aiToolsService.execute).not.toHaveBeenCalled();
      const [, secondCallArgs] = openAiAdapter.complete.mock.calls;
      const toolMessage = secondCallArgs[0].messages.find((m: any) => m.role === 'tool');
      expect(JSON.parse(toolMessage.content)).toEqual({ ok: false, error: 'This tool is not enabled for this agent.' });
    });

    it('stops after MAX_TOOL_ITERATIONS and sends nothing if the model never stops calling tools', async () => {
      prisma.client.conversation.findUnique.mockResolvedValue(baseConversation);
      prisma.client.aiAgent.findMany.mockResolvedValue([openAgent({ enabledTools: ['check_stock'] })]);
      prisma.client.message.findUnique.mockResolvedValue({ id: 'msg1', direction: 'INBOUND', content: '¿hay stock?' });
      openAiAdapter.complete.mockResolvedValue({
        content: '',
        promptTokens: 1,
        completionTokens: 1,
        toolCalls: [{ id: 'call_x', name: 'check_stock', arguments: '{}' }],
      });
      aiToolsService.execute.mockResolvedValue({ ok: true, data: {} });

      await service.generateReply('t1', 'conv1', 'msg1');

      // One initial call, then up to MAX_TOOL_ITERATIONS (6) more while the
      // model keeps calling tools.
      expect(openAiAdapter.complete).toHaveBeenCalledTimes(7);
      expect(messagesService.create).not.toHaveBeenCalled();
    });
  });
});
