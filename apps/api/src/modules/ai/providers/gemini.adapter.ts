import { Injectable } from '@nestjs/common';
import { ValidationError } from '@omniflow/utils';
import { LlmAdapter, LlmCompletionParams, LlmCompletionResult, LlmMessage } from './llm-adapter.types';

// Gemini takes the system prompt as its own `systemInstruction` field (not a
// message in `contents`), and uses "model" instead of "assistant" as the
// role for the model's own turns.
function splitSystemPrompt(messages: LlmMessage[]): { system?: string; rest: LlmMessage[] } {
  const systemMessages = messages.filter((m) => m.role === 'system');
  const rest = messages.filter((m) => m.role !== 'system');
  return { system: systemMessages.map((m) => m.content).join('\n\n') || undefined, rest };
}

@Injectable()
export class GeminiAdapter implements LlmAdapter {
  async complete(params: LlmCompletionParams): Promise<LlmCompletionResult> {
    if (!params.apiKey) {
      throw new ValidationError('Gemini is not configured for this tenant');
    }

    const { system, rest } = splitSystemPrompt(params.messages);

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${params.model}:generateContent?key=${params.apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: rest.map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })),
          ...(system && { systemInstruction: { parts: [{ text: system }] } }),
          generationConfig: { temperature: params.temperature, maxOutputTokens: params.maxTokens },
          ...(params.tools?.length && {
            tools: [{ functionDeclarations: params.tools.map((t) => ({ name: t.name, description: t.description, parameters: t.parameters })) }],
          }),
        }),
      },
    );

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(`Gemini completion failed: ${response.status} ${text}`);
    }

    const data: any = await response.json();
    const parts: any[] = data.candidates?.[0]?.content?.parts ?? [];
    const textContent = parts.filter((p) => typeof p.text === 'string').map((p) => p.text).join('');
    const toolCalls = parts
      .filter((p) => p.functionCall)
      .map((p) => ({ name: p.functionCall.name, arguments: JSON.stringify(p.functionCall.args ?? {}) }));

    return {
      content: textContent,
      promptTokens: data.usageMetadata?.promptTokenCount ?? 0,
      completionTokens: data.usageMetadata?.candidatesTokenCount ?? 0,
      ...(toolCalls.length && { toolCalls }),
    };
  }
}
