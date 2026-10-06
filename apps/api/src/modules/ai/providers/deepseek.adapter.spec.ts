import { DeepSeekAdapter } from './deepseek.adapter';
import { ValidationError } from '@omniflow/utils';

describe('DeepSeekAdapter', () => {
  let adapter: DeepSeekAdapter;
  const originalFetch = global.fetch;

  beforeEach(() => {
    adapter = new DeepSeekAdapter();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('throws ValidationError when no apiKey is given', async () => {
    await expect(
      adapter.complete({ apiKey: '', model: 'deepseek-chat', messages: [], temperature: 0.7, maxTokens: 500 }),
    ).rejects.toThrow(ValidationError);
  });

  it('throws when the DeepSeek API responds with a non-OK status', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 401, text: () => Promise.resolve('unauthorized') }) as any;

    await expect(
      adapter.complete({ apiKey: 'ds-test', model: 'deepseek-chat', messages: [], temperature: 0.7, maxTokens: 500 }),
    ).rejects.toThrow('DeepSeek completion failed: 401 unauthorized');
  });

  it('parses content and token usage from a successful response', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          choices: [{ message: { content: 'Hola, ¿en qué te ayudo?' } }],
          usage: { prompt_tokens: 30, completion_tokens: 12 },
        }),
    }) as any;

    const result = await adapter.complete({
      apiKey: 'ds-test',
      model: 'deepseek-chat',
      messages: [{ role: 'user', content: 'hola' }],
      temperature: 0.7,
      maxTokens: 500,
    });

    expect(result).toEqual({ content: 'Hola, ¿en qué te ayudo?', promptTokens: 30, completionTokens: 12 });
    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.deepseek.com/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer ds-test' }),
      }),
    );
  });

  it('translates tools into the OpenAI function-calling shape and parses tool_calls back', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          choices: [
            {
              message: {
                content: null,
                tool_calls: [{ function: { name: 'send_storefront_link', arguments: '{"action":"STORE"}' } }],
              },
            },
          ],
          usage: { prompt_tokens: 50, completion_tokens: 10 },
        }),
    }) as any;

    const result = await adapter.complete({
      apiKey: 'ds-test',
      model: 'deepseek-chat',
      messages: [{ role: 'user', content: 'quiero comprar' }],
      temperature: 0.7,
      maxTokens: 500,
      tools: [{ name: 'send_storefront_link', description: 'Envía un enlace real', parameters: { type: 'object', properties: {} } }],
    });

    expect(result.toolCalls).toEqual([{ name: 'send_storefront_link', arguments: '{"action":"STORE"}' }]);
  });

  it('translates a tool-call/tool-result turn pair the same way as OpenAI', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ choices: [{ message: { content: 'Tenemos 3 en stock.' } }], usage: {} }),
    }) as any;

    await adapter.complete({
      apiKey: 'ds-test',
      model: 'deepseek-chat',
      messages: [
        { role: 'assistant', content: '', toolCalls: [{ id: 'call_1', name: 'check_stock', arguments: '{"productId":"p1"}' }] },
        { role: 'tool', toolCallId: 'call_1', content: '{"stock":3}' },
      ],
      temperature: 0.7,
      maxTokens: 500,
    });

    const [, init] = (global.fetch as jest.Mock).mock.calls[0];
    const body = JSON.parse(init.body);
    expect(body.messages).toEqual([
      {
        role: 'assistant',
        content: null,
        tool_calls: [{ id: 'call_1', type: 'function', function: { name: 'check_stock', arguments: '{"productId":"p1"}' } }],
      },
      { role: 'tool', tool_call_id: 'call_1', content: '{"stock":3}' },
    ]);
  });
});
