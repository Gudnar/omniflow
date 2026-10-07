import { Injectable } from '@nestjs/common';
import { logger } from '@omniflow/utils';
import { AiProviderType } from '@omniflow/database';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContextService } from '../tenant-context/tenant-context.service';
import { MessagesService } from '../conversations/messages.service';
import { ConversationsService } from '../conversations/conversations.service';
import { OpenAiAdapter } from './providers/openai.adapter';
import { AnthropicAdapter } from './providers/anthropic.adapter';
import { GeminiAdapter } from './providers/gemini.adapter';
import { DeepSeekAdapter } from './providers/deepseek.adapter';
import { LlmAdapter, LlmMessage, LlmTool, LlmToolCall } from './providers/llm-adapter.types';
import { KnowledgeSearchService } from '../knowledge/knowledge-search.service';
import { ContactCommerceService } from '../commerce/contact-commerce.service';
import { AiCredentialsService } from './ai-credentials.service';
import { AiToolsService } from './tools/ai-tools.service';
import { getToolDefinition } from './tools/registry';

const HISTORY_LIMIT = 20;
const SEND_STOREFRONT_LINK_TOOL = 'send_storefront_link';
const SEND_QUICK_REPLIES_TOOL = 'send_quick_replies';
const SEND_FORM_TOOL = 'send_form';
const SEND_WEBCHAT_LINK_TOOL = 'send_webchat_link';
// Sending the interactive element to the customer IS the reply for these —
// ends the turn immediately on success, unlike the generic ecommerce/booking
// data tools in AiToolsService. A REJECTED call (bad/unauthorized arguments)
// still gets one retry with a tool-error result — see generateReply — so a
// model that eagerly calls one of these with no accompanying text doesn't
// leave the conversation with nothing sent at all.
const TERMINAL_TOOL_NAMES = new Set([SEND_STOREFRONT_LINK_TOOL, SEND_QUICK_REPLIES_TOOL, SEND_FORM_TOOL, SEND_WEBCHAT_LINK_TOOL]);
const MAX_CTA_MESSAGE_LENGTH = 300;
const FORM_FIELD_TYPES = new Set(['text', 'email', 'tel', 'number']);
// Hard ceiling on how many times one reply can round-trip through a tool
// call before giving up and treating whatever text the model has produced
// (often none) as final — guards against a model stuck calling tools in a
// loop never converging on an answer.
const MAX_TOOL_ITERATIONS = 6;

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
  leadContext?: { isNewContact: boolean; adHeadline?: string | null },
) {
  const lines = [
    `Eres un agente de atención al cliente por chat, respondiendo en nombre de un negocio.`,
    `Responde siempre en el idioma: ${agent.language}.`,
  ];
  if (agent.personality) lines.push(`Personalidad: ${agent.personality}.`);
  if (agent.goal) lines.push(`Objetivo: ${agent.goal}.`);
  if (contactName) lines.push(`Estás hablando con: ${contactName}.`);
  if (leadContext?.isNewContact) {
    lines.push('Este es un contacto nuevo que te escribe por primera vez — sé proactivo en ofrecerle la tienda o agendar una cita, y guía la conversación hacia cerrar una venta o reserva.');
    if (leadContext.adHeadline) {
      lines.push(`Llegó desde un anuncio con el texto "${leadContext.adHeadline}" — puedes referenciarlo naturalmente si ayuda a la conversación.`);
    }
  }
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
// (KnowledgeSearchService) and in Phase 14 with the full ecommerce/booking
// tool suite (AiToolsService) — the orchestrator invoked from
// InternalAiActionsController (apps/worker enqueues this off the hot webhook
// path, same "queue → worker → internal callback" shape as
// InternalFlowActionsController). Runs a standard multi-turn tool-calling
// loop (call model → execute any requested tools → feed results back → call
// model again) up to MAX_TOOL_ITERATIONS, same shape regardless of which
// provider the agent uses (each LlmAdapter translates the canonical
// LlmMessage history to/from its own wire format). send_storefront_link
// stays separate and `terminal` — it's a UI handoff, not a data tool, and
// its own side effect (the CTA message) IS the reply.
@Injectable()
export class AiReplyService {
  private readonly adapters: Record<AiProviderType, LlmAdapter>;

  constructor(
    private prisma: PrismaService,
    private tenantContext: TenantContextService,
    private messagesService: MessagesService,
    private conversationsService: ConversationsService,
    openAiAdapter: OpenAiAdapter,
    anthropicAdapter: AnthropicAdapter,
    geminiAdapter: GeminiAdapter,
    deepSeekAdapter: DeepSeekAdapter,
    private knowledgeSearchService: KnowledgeSearchService,
    private contactCommerceService: ContactCommerceService,
    private aiCredentialsService: AiCredentialsService,
    private aiToolsService: AiToolsService,
  ) {
    this.adapters = {
      OPENAI: openAiAdapter,
      ANTHROPIC: anthropicAdapter,
      GEMINI: geminiAdapter,
      DEEPSEEK: deepSeekAdapter,
    };
  }

  async generateReply(tenantId: string, conversationId: string, messageId: string): Promise<void> {
    this.tenantContext.setContext({ tenantId });

    const conversation = await this.prisma.client.conversation.findUnique({
      where: { id: conversationId },
      include: { contact: { select: { id: true, name: true } } },
    });
    // A human already owns this conversation, it's closed, or the WhatsApp
    // "returning contact" one-shot CTA flow paused it (MetaWebhookService) —
    // never talk over any of those.
    if (!conversation || conversation.assignedToId || conversation.status === 'CLOSED' || conversation.aiPaused) return;

    // Exactly one ACTIVE agent must claim this channel (AiAgentsService
    // enforces this invariant at write time) — zero or more-than-one both
    // mean "don't auto-reply," never "guess."
    const candidates = await this.prisma.client.aiAgent.findMany({
      where: { status: 'ACTIVE', channels: { has: conversation.channel } },
      include: { model: { include: { provider: true } } },
    });
    if (candidates.length !== 1) return;
    const agent = candidates[0];

    // One adapter per AiProviderType (see each provider's own doc comment);
    // a provider missing from the map (shouldn't happen given the seeded
    // catalog) means no known way to call it — never guess at a format.
    const adapter = this.adapters[agent.model.provider.type as AiProviderType];
    if (!adapter) return;

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
      {
        role: 'system',
        content: buildSystemPrompt(agent, conversation.contact?.name, knowledgeChunks, {
          isNewContact: conversation.isNewContact,
          adHeadline: (conversation.adReferral as any)?.headline,
        }),
      },
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

    // Tool Policy: only tools this specific agent was explicitly enabled
    // for (AiAgent.enabledTools, set by an admin with ai.manage) are ever
    // offered to the model — same gate is re-checked per call below, so a
    // hallucinated/unauthorized tool name can never execute even if some
    // provider is lenient about calling tools it wasn't given.
    const enabledTools: string[] = agent.enabledTools ?? [];
    const dataTools: LlmTool[] = enabledTools
      .map((name) => getToolDefinition(name))
      .filter((d): d is NonNullable<typeof d> => !!d)
      .map((d) => ({ name: d.name, description: d.description, parameters: d.parameters }));
    const offeredTools: LlmTool[] = [...(allowedActions.length ? [buildStorefrontLinkTool(allowedActions)] : []), ...dataTools];

    let messages: LlmMessage[] = chatMessages;
    let completion = await adapter.complete({
      apiKey,
      model: agent.model.name,
      messages,
      temperature: agent.temperature,
      maxTokens: agent.maxTokens,
      ...(offeredTools.length && { tools: offeredTools }),
    });
    let promptTokens = completion.promptTokens;
    let completionTokens = completion.completionTokens;

    for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS && completion.toolCalls?.length; iteration++) {
      const terminalCall = completion.toolCalls.find((tc) => TERMINAL_TOOL_NAMES.has(tc.name));
      if (terminalCall) {
        // send_storefront_link is gated by store capability (canBuy/canBook),
        // not enabledTools — same as always. The two new conversation tools
        // follow the normal Tool Policy gate like any data tool.
        const authorized = terminalCall.name === SEND_STOREFRONT_LINK_TOOL || enabledTools.includes(terminalCall.name);
        if (!authorized) {
          logger.warn('AI tool call rejected: tool not enabled for this agent', { conversationId, agentId: agent.id, tool: terminalCall.name });
          break;
        }
        const sent = await this.handleTerminalToolCall(terminalCall, {
          conversationId,
          contactId: conversation.contactId,
          agentId: agent.id,
          channel: conversation.channel,
          canBuy,
          canBook,
          promptTokens,
          completionTokens,
        });
        if (sent) return;

        // Authorized tool, but rejected arguments (e.g. asked for a STORE
        // link on a BOOKING-only store, or left out the required message) —
        // give the model one more turn with a plain tool-error result
        // instead of silently dropping everything. Without this, a model
        // that calls the tool with bad args and no accompanying text (common
        // for tool-calling models) leaves nothing at all to send — this was
        // observed in production as a conversation going completely silent
        // because the agent's own goal pushed it to call this tool on every
        // single inbound message, including plain greetings.
        messages = [...messages, { role: 'assistant', content: completion.content, toolCalls: completion.toolCalls }];
        messages.push({
          role: 'tool',
          toolCallId: terminalCall.id,
          toolName: terminalCall.name,
          content: JSON.stringify({ ok: false, error: 'Invalid or unavailable arguments for this action — reply with a normal text message instead.' }),
        });
        completion = await adapter.complete({
          apiKey,
          model: agent.model.name,
          messages,
          temperature: agent.temperature,
          maxTokens: agent.maxTokens,
          ...(offeredTools.length && { tools: offeredTools }),
        });
        promptTokens += completion.promptTokens;
        completionTokens += completion.completionTokens;
        continue;
      }

      messages = [...messages, { role: 'assistant', content: completion.content, toolCalls: completion.toolCalls }];

      for (const call of completion.toolCalls) {
        const result = enabledTools.includes(call.name)
          ? await this.aiToolsService.execute(call.name, call.arguments, {
              tenantId,
              contactId: conversation.contactId,
              conversationId,
              agentId: agent.id,
            })
          : (() => {
              logger.warn('AI tool call rejected: tool not enabled for this agent', { conversationId, agentId: agent.id, tool: call.name });
              return { ok: false, error: 'This tool is not enabled for this agent.' };
            })();
        messages.push({ role: 'tool', toolCallId: call.id, toolName: call.name, content: JSON.stringify(result) });
      }

      completion = await adapter.complete({
        apiKey,
        model: agent.model.name,
        messages,
        temperature: agent.temperature,
        maxTokens: agent.maxTokens,
        ...(offeredTools.length && { tools: offeredTools }),
      });
      promptTokens += completion.promptTokens;
      completionTokens += completion.completionTokens;
    }

    if (!completion.content.trim()) return;

    await this.prisma.client.aiUsage.create({
      data: { agentId: agent.id, conversationId, promptTokens, completionTokens, totalTokens: promptTokens + completionTokens },
    });

    await this.messagesService.create(conversationId, agent.id, {
      direction: 'OUTBOUND',
      type: 'TEXT',
      content: completion.content,
    });
  }

  private async handleTerminalToolCall(toolCall: LlmToolCall, ctx: TerminalToolContext): Promise<boolean> {
    switch (toolCall.name) {
      case SEND_STOREFRONT_LINK_TOOL:
        return this.handleStorefrontLinkCall(toolCall, ctx);
      case SEND_QUICK_REPLIES_TOOL:
        return this.handleSendQuickReplies(toolCall, ctx);
      case SEND_FORM_TOOL:
        return this.handleSendForm(toolCall, ctx);
      case SEND_WEBCHAT_LINK_TOOL:
        return this.handleSendWebchatLink(toolCall, ctx);
      default:
        return false;
    }
  }

  private async recordUsage(ctx: TerminalToolContext) {
    await this.prisma.client.aiUsage.create({
      data: {
        agentId: ctx.agentId,
        conversationId: ctx.conversationId,
        promptTokens: ctx.promptTokens,
        completionTokens: ctx.completionTokens,
        totalTokens: ctx.promptTokens + ctx.completionTokens,
      },
    });
  }

  // Returns true when the CTA message was actually sent (and usage already
  // recorded) — the caller ends the turn immediately in that case. Returns
  // false for an unauthorized/invalid call, leaving the caller to fall back
  // to sending completion.content as a normal TEXT reply if there is any.
  private async handleStorefrontLinkCall(toolCall: LlmToolCall, ctx: TerminalToolContext): Promise<boolean> {
    let args: { action?: string; message?: string } = {};
    try {
      args = JSON.parse(toolCall.arguments);
    } catch {
      logger.warn('AI tool call had unparsable arguments', { conversationId: ctx.conversationId, agentId: ctx.agentId });
    }

    const action = args.action === 'STORE' || args.action === 'BOOKING' ? args.action : null;
    const introMessage = typeof args.message === 'string' ? args.message.trim().slice(0, MAX_CTA_MESSAGE_LENGTH) : '';
    const authorized = (action === 'STORE' && ctx.canBuy) || (action === 'BOOKING' && ctx.canBook);

    if (action && authorized && introMessage) {
      const { url: storeUrl } = await this.contactCommerceService.generateStorefrontLink(ctx.contactId);
      const [path, query] = storeUrl.split('?');
      const url = action === 'BOOKING' ? `${path}/reservas?${query}` : storeUrl;
      const label = action === 'BOOKING' ? 'Reservar cita' : 'Ir a la tienda';

      await this.recordUsage(ctx);
      await this.messagesService.create(ctx.conversationId, ctx.agentId, {
        direction: 'OUTBOUND',
        type: 'CTA',
        content: `${introMessage}\n\n${url}`,
        ctaPayload: { action, url, label },
      } as any);
      return true;
    }

    // Model called the tool with an action it was never offered, or with
    // missing/invalid arguments — never falls back to inventing free text
    // here; the caller decides what (if anything) happens next.
    logger.warn('AI tool call rejected: unauthorized or invalid arguments', { conversationId: ctx.conversationId, agentId: ctx.agentId, action: args.action });
    return false;
  }

  private async handleSendQuickReplies(toolCall: LlmToolCall, ctx: TerminalToolContext): Promise<boolean> {
    let args: { message?: string; options?: unknown } = {};
    try {
      args = JSON.parse(toolCall.arguments);
    } catch {
      logger.warn('AI tool call had unparsable arguments', { conversationId: ctx.conversationId, agentId: ctx.agentId });
    }

    const message = typeof args.message === 'string' ? args.message.trim().slice(0, MAX_CTA_MESSAGE_LENGTH) : '';
    const options = Array.isArray(args.options) ? args.options.filter((o): o is string => typeof o === 'string' && o.trim().length > 0) : [];

    if (!message || options.length < 2 || options.length > 3) {
      logger.warn('AI tool call rejected: invalid send_quick_replies arguments', { conversationId: ctx.conversationId, agentId: ctx.agentId });
      return false;
    }

    await this.recordUsage(ctx);
    await this.messagesService.sendQuickReplies(ctx.conversationId, ctx.agentId, { message, options });
    return true;
  }

  private async handleSendForm(toolCall: LlmToolCall, ctx: TerminalToolContext): Promise<boolean> {
    if (ctx.channel !== 'WEBCHAT') {
      logger.warn('AI tool call rejected: send_form is only valid on web chat conversations', { conversationId: ctx.conversationId, agentId: ctx.agentId, channel: ctx.channel });
      return false;
    }

    let args: { message?: string; fields?: unknown; submitLabel?: string } = {};
    try {
      args = JSON.parse(toolCall.arguments);
    } catch {
      logger.warn('AI tool call had unparsable arguments', { conversationId: ctx.conversationId, agentId: ctx.agentId });
    }

    const message = typeof args.message === 'string' ? args.message.trim().slice(0, MAX_CTA_MESSAGE_LENGTH) : '';
    const fields = Array.isArray(args.fields)
      ? args.fields.filter(
          (f): f is { label: string; fieldType: string } =>
            !!f && typeof (f as any).label === 'string' && (f as any).label.trim().length > 0 && FORM_FIELD_TYPES.has((f as any).fieldType),
        )
      : [];

    if (!message || fields.length < 1 || fields.length > 6) {
      logger.warn('AI tool call rejected: invalid send_form arguments', { conversationId: ctx.conversationId, agentId: ctx.agentId });
      return false;
    }

    await this.recordUsage(ctx);
    await this.messagesService.sendForm(ctx.conversationId, ctx.agentId, {
      message,
      fields: fields as { label: string; fieldType: 'text' | 'email' | 'tel' | 'number' }[],
      submitLabel: typeof args.submitLabel === 'string' ? args.submitLabel.trim() : undefined,
    });
    return true;
  }

  // Reuses ConversationsService.generateWebLink — the exact same link the
  // "Enviar enlace web" button in chat-panel.tsx already generates for staff
  // — so the agent can offer it on its own, on any channel but webchat
  // itself (redirecting a webchat conversation to webchat is pointless).
  private async handleSendWebchatLink(toolCall: LlmToolCall, ctx: TerminalToolContext): Promise<boolean> {
    if (ctx.channel === 'WEBCHAT') {
      logger.warn('AI tool call rejected: send_webchat_link makes no sense on a webchat conversation', { conversationId: ctx.conversationId, agentId: ctx.agentId });
      return false;
    }

    let args: { message?: string } = {};
    try {
      args = JSON.parse(toolCall.arguments);
    } catch {
      logger.warn('AI tool call had unparsable arguments', { conversationId: ctx.conversationId, agentId: ctx.agentId });
    }

    const introMessage = typeof args.message === 'string' ? args.message.trim().slice(0, MAX_CTA_MESSAGE_LENGTH) : '';
    if (!introMessage) {
      logger.warn('AI tool call rejected: invalid send_webchat_link arguments', { conversationId: ctx.conversationId, agentId: ctx.agentId });
      return false;
    }

    const { url } = await this.conversationsService.generateWebLink(ctx.conversationId);

    await this.recordUsage(ctx);
    await this.messagesService.create(ctx.conversationId, ctx.agentId, {
      direction: 'OUTBOUND',
      type: 'CTA',
      content: `${introMessage}\n\n${url}`,
      ctaPayload: { action: 'STORE', url, label: 'Continuar por chat web' },
    } as any);
    return true;
  }
}

interface TerminalToolContext {
  conversationId: string;
  contactId: string;
  agentId: string;
  channel: string;
  canBuy: boolean;
  canBook: boolean;
  promptTokens: number;
  completionTokens: number;
}
