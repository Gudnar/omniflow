import { Injectable } from '@nestjs/common';
import { ValidationError } from '@omniflow/utils';
import { LlmAdapter, LlmCompletionParams, LlmCompletionResult } from './llm-adapter.types';
import { toOpenAiMessages } from './openai.adapter';

// DeepSeek's API is OpenAI-compatible (same request/response shape,
// including tool calling) — same pattern as OpenAiAdapter, pointed at
// DeepSeek's own base URL (https://api.deepseek.com, no "/v1" segment, per
// their own docs' recommended base_url).
@Injectable()
export class DeepSeekAdapter implements LlmAdapter {
  async complete(params: LlmCompletionParams): Promise<LlmCompletionResult> {
    if (!params.apiKey) {
      throw new ValidationError('DeepSeek is not configured for this tenant');
    }

    const response = await fetch('https://api.deepseek.com/chat/completions', {
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
      throw new Error(`DeepSeek completion failed: ${response.status} ${text}`);
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
