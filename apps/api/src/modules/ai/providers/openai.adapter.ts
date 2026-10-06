import { Injectable } from '@nestjs/common';
import { ValidationError } from '@omniflow/utils';
import { LlmAdapter, LlmCompletionParams, LlmCompletionResult, LlmMessage } from './llm-adapter.types';

export * from './llm-adapter.types';

// Translates the canonical multi-turn shape (see llm-adapter.types.ts) into
// OpenAI's own wire format: a flat 'tool' role + 'tool_call_id', and an
// assistant message that called tools carries them in `tool_calls`.
export function toOpenAiMessages(messages: LlmMessage[]): any[] {
  return messages.map((m) => {
    if (m.role === 'assistant' && m.toolCalls?.length) {
      return {
        role: 'assistant',
        content: m.content || null,
        tool_calls: m.toolCalls.map((tc) => ({ id: tc.id, type: 'function', function: { name: tc.name, arguments: tc.arguments } })),
      };
    }
    if (m.role === 'tool') {
      return { role: 'tool', tool_call_id: m.toolCallId, content: m.content };
    }
    return { role: m.role, content: m.content };
  });
}

@Injectable()
export class OpenAiAdapter implements LlmAdapter {
  async complete(params: LlmCompletionParams): Promise<LlmCompletionResult> {
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
        messages: toOpenAiMessages(params.messages),
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
      id: tc.id,
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
