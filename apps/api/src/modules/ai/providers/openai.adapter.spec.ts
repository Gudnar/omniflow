import { OpenAiAdapter } from './openai.adapter';
import { ValidationError } from '@omniflow/utils';

describe('OpenAiAdapter', () => {
  let adapter: OpenAiAdapter;
  const originalFetch = global.fetch;

  beforeEach(() => {
    adapter = new OpenAiAdapter();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('throws ValidationError when no apiKey is given', async () => {
    await expect(
      adapter.complete({ apiKey: '', model: 'gpt-4o-mini', messages: [], temperature: 0.7, maxTokens: 500 }),
    ).rejects.toThrow(ValidationError);
  });

  it('throws when the OpenAI API responds with a non-OK status', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 401, text: () => Promise.resolve('unauthorized') }) as any;

    await expect(
      adapter.complete({ apiKey: 'sk-test', model: 'gpt-4o-mini', messages: [], temperature: 0.7, maxTokens: 500 }),
    ).rejects.toThrow('OpenAI completion failed: 401 unauthorized');
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
      apiKey: 'sk-test',
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: 'hola' }],
      temperature: 0.7,
      maxTokens: 500,
    });

    expect(result).toEqual({ content: 'Hola, ¿en qué te ayudo?', promptTokens: 30, completionTokens: 12 });
    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.openai.com/v1/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer sk-test' }),
      }),
    );
  });

  it('omits tools/tool_choice from the request body when no tools are given', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ choices: [{ message: { content: 'hola' } }], usage: {} }),
    }) as any;

    await adapter.complete({ apiKey: 'sk-test', model: 'gpt-4o-mini', messages: [], temperature: 0.7, maxTokens: 500 });

    const [, init] = (global.fetch as jest.Mock).mock.calls[0];
    const body = JSON.parse(init.body);
    expect(body.tools).toBeUndefined();
    expect(body.tool_choice).toBeUndefined();
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
      apiKey: 'sk-test',
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: 'quiero comprar' }],
      temperature: 0.7,
      maxTokens: 500,
      tools: [{ name: 'send_storefront_link', description: 'Envía un enlace real', parameters: { type: 'object', properties: {} } }],
    });

    const [, init] = (global.fetch as jest.Mock).mock.calls[0];
    const body = JSON.parse(init.body);
    expect(body.tool_choice).toBe('auto');
    expect(body.tools).toEqual([
      {
        type: 'function',
        function: { name: 'send_storefront_link', description: 'Envía un enlace real', parameters: { type: 'object', properties: {} } },
      },
    ]);

    expect(result.toolCalls).toEqual([{ name: 'send_storefront_link', arguments: '{"action":"STORE"}' }]);
  });

  it('translates an assistant tool-call turn and its tool result into OpenAI tool_calls/tool_call_id messages', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ choices: [{ message: { content: 'Tenemos 3 en stock.' } }], usage: {} }),
    }) as any;

    await adapter.complete({
      apiKey: 'sk-test',
      model: 'gpt-4o-mini',
      messages: [
        { role: 'user', content: '¿hay stock?' },
        { role: 'assistant', content: '', toolCalls: [{ id: 'call_1', name: 'check_stock', arguments: '{"productId":"p1"}' }] },
        { role: 'tool', toolCallId: 'call_1', content: '{"stock":3}' },
      ],
      temperature: 0.7,
      maxTokens: 500,
    });

    const [, init] = (global.fetch as jest.Mock).mock.calls[0];
    const body = JSON.parse(init.body);
    expect(body.messages).toEqual([
      { role: 'user', content: '¿hay stock?' },
      {
        role: 'assistant',
        content: null,
        tool_calls: [{ id: 'call_1', type: 'function', function: { name: 'check_stock', arguments: '{"productId":"p1"}' } }],
      },
      { role: 'tool', tool_call_id: 'call_1', content: '{"stock":3}' },
    ]);
  });
});
