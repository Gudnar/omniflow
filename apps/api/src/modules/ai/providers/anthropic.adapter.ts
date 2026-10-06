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

// Anthropic has no flat 'tool' role: a tool call is a `tool_use` content
// block on an assistant turn, and its result is a `tool_result` block on the
// NEXT user turn — and when an assistant turn called several tools at once,
// all their results must come back bundled into a single user message (not
// one message per result), so consecutive 'tool' messages are grouped here.
function toAnthropicMessages(messages: LlmMessage[]): any[] {
  const out: any[] = [];
  for (const m of messages) {
    if (m.role === 'assistant' && m.toolCalls?.length) {
      out.push({
        role: 'assistant',
        content: [
          ...(m.content ? [{ type: 'text', text: m.content }] : []),
          ...m.toolCalls.map((tc) => ({ type: 'tool_use', id: tc.id, name: tc.name, input: safeParse(tc.arguments) })),
        ],
      });
      continue;
    }
    if (m.role === 'tool') {
      const last = out[out.length - 1];
      const block = { type: 'tool_result', tool_use_id: m.toolCallId, content: m.content };
      if (last?.role === 'user' && Array.isArray(last.content) && last.content[0]?.type === 'tool_result') {
        last.content.push(block);
      } else {
        out.push({ role: 'user', content: [block] });
      }
      continue;
    }
    out.push({ role: m.role, content: m.content });
  }
  return out;
}

function safeParse(json: string): unknown {
  try {
    return JSON.parse(json);
  } catch {
    return {};
  }
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
        messages: toAnthropicMessages(rest),
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
      .map((b) => ({ id: b.id, name: b.name, arguments: JSON.stringify(b.input ?? {}) }));

    return {
      content: textContent,
      promptTokens: data.usage?.input_tokens ?? 0,
      completionTokens: data.usage?.output_tokens ?? 0,
      ...(toolCalls.length && { toolCalls }),
    };
  }
}
