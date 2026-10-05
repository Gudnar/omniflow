import { Injectable } from '@nestjs/common';
import { ValidationError } from '@omniflow/utils';
import { LlmAdapter, LlmCompletionParams, LlmCompletionResult, LlmMessage } from './llm-adapter.types';

const ANTHROPIC_VERSION = '2023-06-01';

// Anthropic's Messages API takes `system` as its own top-level field, not a
// message with role "system" — pulled out here so the rest of `messages`
// maps 1:1 onto Anthropic's user/assistant roles.
function splitSystemPrompt(messages: LlmMessage[]): { system?: string; rest: LlmMessage[] } {
  const systemMessages = messages.filter((m) => m.role === 'system');
  const rest = messages.filter((m) => m.role !== 'system');
  return { system: systemMessages.map((m) => m.content).join('\n\n') || undefined, rest };
}

@Injectable()
export class AnthropicAdapter implements LlmAdapter {
  async complete(params: LlmCompletionParams): Promise<LlmCompletionResult> {
    if (!params.apiKey) {
      throw new ValidationError('Anthropic is not configured for this tenant');
    }

    const { system, rest } = splitSystemPrompt(params.messages);

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': params.apiKey,
        'anthropic-version': ANTHROPIC_VERSION,
      },
      body: JSON.stringify({
        model: params.model,
        max_tokens: params.maxTokens,
        temperature: params.temperature,
        ...(system && { system }),
        messages: rest.map((m) => ({ role: m.role, content: m.content })),
        ...(params.tools?.length && {
          tools: params.tools.map((t) => ({ name: t.name, description: t.description, input_schema: t.parameters })),
        }),
      }),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(`Anthropic completion failed: ${response.status} ${text}`);
    }

    const data: any = await response.json();
    const blocks: any[] = data.content ?? [];
    const textContent = blocks.filter((b) => b.type === 'text').map((b) => b.text).join('');
    const toolCalls = blocks
      .filter((b) => b.type === 'tool_use')
      .map((b) => ({ name: b.name, arguments: JSON.stringify(b.input ?? {}) }));

    return {
      content: textContent,
      promptTokens: data.usage?.input_tokens ?? 0,
      completionTokens: data.usage?.output_tokens ?? 0,
      ...(toolCalls.length && { toolCalls }),
    };
  }
}
