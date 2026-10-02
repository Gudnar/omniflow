import { Injectable } from '@nestjs/common';
import { logger } from '@omniflow/utils';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContextService } from '../tenant-context/tenant-context.service';
import { MessagesService } from '../conversations/messages.service';
import { OpenAiAdapter, LlmMessage, LlmTool } from './providers/openai.adapter';
import { KnowledgeSearchService } from '../knowledge/knowledge-search.service';
import { ContactCommerceService } from '../commerce/contact-commerce.service';
import { AiCredentialsService } from './ai-credentials.service';

const HISTORY_LIMIT = 20;
const SEND_STOREFRONT_LINK_TOOL = 'send_storefront_link';
const MAX_CTA_MESSAGE_LENGTH = 300;

// Only ever offered when canBuy/canBook say the store genuinely supports it
// (see generateReply) — the `action` enum is narrowed at build time, and the
// result is re-checked against the same booleans before executing, so a
// hallucinated/stale call can never slip through.
function buildStorefrontLinkTool(allowedActions: ('STORE' | 'BOOKING')[]): LlmTool {
  return {
    name: SEND_STOREFRONT_LINK_TOOL,
    description:
      'Envía al cliente un enlace real para ir a la tienda en línea o reservar una cita. Úsala solo cuando el cliente muestre intención clara de comprar o agendar. Nunca inventes ni escribas URLs manualmente — esta herramienta genera el enlace verdadero.',
    parameters: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: allowedActions },
        message: {
          type: 'string',
          description: 'Mensaje breve y amigable (1-2 frases) que acompaña el enlace, en el idioma configurado del agente. No incluyas la URL, se agrega automáticamente.',
        },
      },
      required: ['action', 'message'],
    },
  };
}

function buildSystemPrompt(
  agent: { goal: string | null; personality: string | null; language: string },
  contactName?: string,
  knowledgeChunks: string[] = [],
) {
  const lines = [
    `Eres un agente de atención al cliente por chat, respondiendo en nombre de un negocio.`,
    `Responde siempre en el idioma: ${agent.language}.`,
  ];
  if (agent.personality) lines.push(`Personalidad: ${agent.personality}.`);
  if (agent.goal) lines.push(`Objetivo: ${agent.goal}.`);
  if (contactName) lines.push(`Estás hablando con: ${contactName}.`);
  if (knowledgeChunks.length) {
    lines.push(
      'Usa la siguiente información del negocio para responder cuando sea relevante. Si la pregunta no se relaciona con esta información, ignórala y responde con tu conocimiento general:',
    );
    knowledgeChunks.forEach((chunk, i) => lines.push(`[${i + 1}] ${chunk}`));
  }
  lines.push('Responde de forma breve, natural y útil, como en una conversación de chat real.');
  return lines.join('\n');
}

// Phase 13: AI foundation, extended in Phase 15 with RAG retrieval
// (KnowledgeSearchService) — the orchestrator invoked from
// InternalAiActionsController (apps/worker enqueues this off the hot webhook
// path, same "queue → worker → internal callback" shape as
// InternalFlowActionsController). Carries a single, narrowly-scoped Phase 14
// tool (send_storefront_link) — not the full ecommerce/booking tool suite
// AI_SPEC.md documents, which remains out of scope.
@Injectable()
export class AiReplyService {
  constructor(
    private prisma: PrismaService,
    private tenantContext: TenantContextService,
    private messagesService: MessagesService,
    private openAiAdapter: OpenAiAdapter,
    private knowledgeSearchService: KnowledgeSearchService,
    private contactCommerceService: ContactCommerceService,
    private aiCredentialsService: AiCredentialsService,
  ) {}

  async generateReply(tenantId: string, conversationId: string, messageId: string): Promise<void> {
    this.tenantContext.setContext({ tenantId });

    const conversation = await this.prisma.client.conversation.findUnique({
      where: { id: conversationId },
      include: { contact: { select: { id: true, name: true } } },
    });
    // A human already owns this conversation, or it's closed — never talk over them.
    if (!conversation || conversation.assignedToId || conversation.status === 'CLOSED') return;

    // Exactly one ACTIVE agent must claim this channel (AiAgentsService
    // enforces this invariant at write time) — zero or more-than-one both
    // mean "don't auto-reply," never "guess."
    const candidates = await this.prisma.client.aiAgent.findMany({
      where: { status: 'ACTIVE', channels: { has: conversation.channel } },
      include: { model: { include: { provider: true } } },
    });
    if (candidates.length !== 1) return;
    const agent = candidates[0];

    // Only OpenAI has a real adapter in this phase (see OpenAiAdapter).
    if (agent.model.provider.type !== 'OPENAI') return;

    // No platform fallback key: if this tenant hasn't configured their own
    // credential for the agent's provider, the agent silently doesn't reply
    // — same no-op convention as "no active agent"/"human assigned" above.
    // Avoids reintroducing a shared-billing/shared-rate-limit key across tenants.
    const apiKey = await this.aiCredentialsService.getDecrypted(tenantId, agent.model.providerId);
    if (!apiKey) return;

    const triggeringMessage = await this.prisma.client.message.findUnique({ where: { id: messageId } });
    if (!triggeringMessage || triggeringMessage.direction !== 'INBOUND') return;

    const lowerContent = triggeringMessage.content.toLowerCase();
    if (agent.escalationKeywords.some((kw: string) => lowerContent.includes(kw.toLowerCase()))) {
      logger.info('AI reply skipped: escalation keyword matched', { conversationId, agentId: agent.id });
      return;
    }

    // AUDIO is included alongside TEXT: by the time this runs, an AUDIO
    // message's content has already been overwritten with its transcript
    // (AiTranscriptionService) — without it here, the triggering message
    // itself (when it's a voice note) would be excluded from its own reply's
    // context.
    const history = await this.prisma.client.message.findMany({
      where: { conversationId, type: { in: ['TEXT', 'AUDIO'] } },
      orderBy: { createdAt: 'desc' },
      take: HISTORY_LIMIT,
    });
    const ordered = history.slice().reverse();

    const knowledgeChunks = await this.knowledgeSearchService.search(agent.id, triggeringMessage.content);

    const chatMessages: LlmMessage[] = [
      { role: 'system', content: buildSystemPrompt(agent, conversation.contact?.name, knowledgeChunks) },
      ...ordered.map((m: any) => ({
        role: m.direction === 'INBOUND' ? ('user' as const) : ('assistant' as const),
        content: m.content,
      })),
    ];

    // Read-only capability check — deliberately NOT EcommerceStoreService's
    // getOrCreate() (that lazily provisions a DRAFT store, a side effect that
    // has no business happening on the hot AI-reply path). No store, or one
    // that isn't PUBLISHED, means the tool isn't even offered to the model.
    const store = await this.prisma.client.ecommerceStore.findUnique({ where: { tenantId } });
    const storeAvailable = store?.status === 'PUBLISHED';
    const canBuy = storeAvailable && (store!.operationMode === 'DIRECT_SALE' || store!.operationMode === 'BOTH');
    const canBook = storeAvailable && (store!.operationMode === 'BOOKING' || store!.operationMode === 'BOTH');
    const allowedActions: ('STORE' | 'BOOKING')[] = [...(canBuy ? (['STORE'] as const) : []), ...(canBook ? (['BOOKING'] as const) : [])];

    const completion = await this.openAiAdapter.complete({
      apiKey,
      model: agent.model.name,
      messages: chatMessages,
      temperature: agent.temperature,
      maxTokens: agent.maxTokens,
      ...(allowedActions.length && { tools: [buildStorefrontLinkTool(allowedActions)] }),
    });

    const toolCall = completion.toolCalls?.find((tc) => tc.name === SEND_STOREFRONT_LINK_TOOL);
    if (toolCall) {
      let args: { action?: string; message?: string } = {};
      try {
        args = JSON.parse(toolCall.arguments);
      } catch {
        logger.warn('AI tool call had unparsable arguments', { conversationId, agentId: agent.id });
      }

      const action = args.action === 'STORE' || args.action === 'BOOKING' ? args.action : null;
      const introMessage = typeof args.message === 'string' ? args.message.trim().slice(0, MAX_CTA_MESSAGE_LENGTH) : '';
      const authorized = (action === 'STORE' && canBuy) || (action === 'BOOKING' && canBook);

      if (action && authorized && introMessage) {
        const { url: storeUrl } = await this.contactCommerceService.generateStorefrontLink(conversation.contactId);
        const [path, query] = storeUrl.split('?');
        const url = action === 'BOOKING' ? `${path}/reservas?${query}` : storeUrl;

        await this.prisma.client.aiUsage.create({
          data: {
            agentId: agent.id,
            conversationId,
            promptTokens: completion.promptTokens,
            completionTokens: completion.completionTokens,
            totalTokens: completion.promptTokens + completion.completionTokens,
          },
        });

        await this.messagesService.create(conversationId, agent.id, {
          direction: 'OUTBOUND',
          type: 'CTA',
          content: `${introMessage}\n\n${url}`,
          ctaPayload: { action, url },
        } as any);
        return;
      }

      // Model called the tool with an action it was never offered, or with
      // missing/invalid arguments — never falls back to inventing free text
      // here; if `completion.content` is also empty (the common case for a
      // tool-call response), the guard below simply no-ops this turn.
      logger.warn('AI tool call rejected: unauthorized or invalid arguments', { conversationId, agentId: agent.id, action: args.action });
    }

    if (!completion.content.trim()) return;

    await this.prisma.client.aiUsage.create({
      data: {
        agentId: agent.id,
        conversationId,
        promptTokens: completion.promptTokens,
        completionTokens: completion.completionTokens,
        totalTokens: completion.promptTokens + completion.completionTokens,
      },
    });

    await this.messagesService.create(conversationId, agent.id, {
      direction: 'OUTBOUND',
      type: 'TEXT',
      content: completion.content,
    });
  }
}
