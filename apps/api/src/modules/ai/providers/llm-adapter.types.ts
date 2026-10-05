export interface LlmMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

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
// not silently inside the adapter.
export interface LlmToolCall {
  name: string;
  arguments: string;
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
