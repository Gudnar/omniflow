// A single function the model may choose to call — JSON-schema `parameters`,
// same shape OpenAI's `tools[].function` expects. Caller (AiReplyService)
// owns authorization (which tools to offer at all) and validation (checking
// the returned arguments before acting on them); each adapter only relays,
// translating to/from its own provider's tool-calling format.
export interface LlmTool {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

// `arguments` is the raw JSON string the model returned — intentionally not
// parsed here so a malformed payload fails in the caller's validated context,
// not silently inside the adapter. `id` correlates this call to the
// corresponding 'tool' result message on the next turn — every provider
// assigns one (Anthropic/Gemini's own call id, or a synthesized one where a
// provider doesn't give one back, e.g. Gemini).
export interface LlmToolCall {
  id: string;
  name: string;
  arguments: string;
}

// Extended beyond plain system/user/assistant to represent a full
// multi-turn tool-calling exchange in one provider-agnostic shape:
//   - an 'assistant' message that called tool(s) carries them in `toolCalls`
//     (content may be empty — some providers return no text alongside a
//     tool call)
//   - the matching result(s) come back as one 'tool' message per call,
//     `toolCallId` naming which call it answers
// Each adapter translates this canonical shape to/from its own wire format
// (OpenAI/DeepSeek's flat `tool` role + `tool_call_id`, Anthropic's
// `tool_use`/`tool_result` content blocks, Gemini's `functionCall`/
// `functionResponse` parts) — AiReplyService's orchestration loop never
// needs to know which provider it's talking to.
export interface LlmMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  toolCalls?: LlmToolCall[];
  toolCallId?: string;
  // Which tool this 'tool' message's result came from — Gemini's function
  // response needs the name (it has no call-id concept); OpenAI/Anthropic
  // ignore it, they correlate by toolCallId instead.
  toolName?: string;
}

export interface LlmCompletionResult {
  content: string;
  promptTokens: number;
  completionTokens: number;
  toolCalls?: LlmToolCall[];
}

export interface LlmCompletionParams {
  apiKey: string;
  model: string;
  messages: LlmMessage[];
  temperature: number;
  maxTokens: number;
  tools?: LlmTool[];
}

// One implementation per AiProviderType (see AiReplyService, which picks the
// adapter matching the agent's configured provider) — plain `fetch` against
// each provider's HTTP API rather than an SDK, since one call per provider
// doesn't justify 4 new dependencies (CLAUDE.md: "Do not implement
// speculative dependencies").
export interface LlmAdapter {
  complete(params: LlmCompletionParams): Promise<LlmCompletionResult>;
}
