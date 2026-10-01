import { AiReplyService } from './ai-reply.service';

describe('AiReplyService', () => {
  let service: AiReplyService;
  let prisma: any;
  let tenantContext: any;
  let messagesService: any;
  let openAiAdapter: any;
  let knowledgeSearchService: any;
  let contactCommerceService: any;

  const openAgent = (overrides: any = {}) => ({
    id: 'agent-1',
    temperature: 0.7,
    maxTokens: 500,
    language: 'es',
    goal: null,
    personality: null,
    escalationKeywords: [],
    model: { name: 'gpt-4o-mini', provider: { type: 'OPENAI' } },
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
    messagesService = { create: jest.fn() };
    openAiAdapter = { complete: jest.fn() };
    knowledgeSearchService = { search: jest.fn().mockResolvedValue([]) };
    contactCommerceService = { generateStorefrontLink: jest.fn() };
    service = new AiReplyService(prisma, tenantContext, messagesService, openAiAdapter, knowledgeSearchService, contactCommerceService);
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

  it('no-ops when the matched agent uses a provider other than OpenAI', async () => {
    prisma.client.conversation.findUnique.mockResolvedValue({ id: 'conv1', assignedToId: null, status: 'OPEN', channel: 'WHATSAPP' });
    prisma.client.aiAgent.findMany.mockResolvedValue([openAgent({ model: { name: 'claude-sonnet-4-5', provider: { type: 'ANTHROPIC' } } })]);
    await service.generateReply('t1', 'conv1', 'msg1');
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
        ctaPayload: { action: 'STORE', url: 'http://localhost:3000/tienda/demo?s=abc123' },
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
        ctaPayload: { action: 'BOOKING', url: 'http://localhost:3000/tienda/demo/reservas?s=abc123' },
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
});
