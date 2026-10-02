import { Injectable } from '@nestjs/common';
import { ValidationError } from '@omniflow/utils';

export interface LlmMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

// A single function the model may choose to call — JSON-schema `parameters`,
// same shape OpenAI's `tools[].function` expects. Caller (AiReplyService)
// owns authorization (which tools to offer at all) and validation (checking
// the returned arguments before acting on them); this adapter only relays.
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

// The only real adapter in this phase (AI_SPEC.md's "Providers" section
// documents OpenAI/Anthropic/Gemini as the target set, but only OpenAI has
// an API key configured — see AiCatalogService.isConfigured). Plain `fetch`
// rather than the official SDK: one HTTP call doesn't justify a new
// dependency (CLAUDE.md: "Do not implement speculative dependencies").
@Injectable()
export class OpenAiAdapter {
  async complete(params: {
    apiKey: string;
    model: string;
    messages: LlmMessage[];
    temperature: number;
    maxTokens: number;
    tools?: LlmTool[];
  }): Promise<LlmCompletionResult> {
    if (!params.apiKey) {
      throw new ValidationError('OpenAI is not configured for this tenant');
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${params.apiKey}`,
      },
      body: JSON.stringify({
        model: params.model,
        messages: params.messages,
        temperature: params.temperature,
        max_tokens: params.maxTokens,
        ...(params.tools?.length && {
          tools: params.tools.map((t) => ({ type: 'function', function: t })),
          tool_choice: 'auto',
        }),
      }),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(`OpenAI completion failed: ${response.status} ${text}`);
    }

    const data: any = await response.json();
    const toolCalls = data.choices?.[0]?.message?.tool_calls?.map((tc: any) => ({
      name: tc.function.name,
      arguments: tc.function.arguments,
    }));
    return {
      content: data.choices?.[0]?.message?.content ?? '',
      promptTokens: data.usage?.prompt_tokens ?? 0,
      completionTokens: data.usage?.completion_tokens ?? 0,
      ...(toolCalls?.length && { toolCalls }),
    };
  }
}
