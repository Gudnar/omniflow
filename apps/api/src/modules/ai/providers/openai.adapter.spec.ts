import { OpenAiAdapter } from './openai.adapter';
import { ValidationError } from '@omniflow/utils';

describe('OpenAiAdapter', () => {
  let adapter: OpenAiAdapter;
  const originalEnv = process.env.OPENAI_API_KEY;
  const originalFetch = global.fetch;

  beforeEach(() => {
    adapter = new OpenAiAdapter();
  });

  afterEach(() => {
    process.env.OPENAI_API_KEY = originalEnv;
    global.fetch = originalFetch;
  });

  it('throws ValidationError when OPENAI_API_KEY is not set', async () => {
    delete process.env.OPENAI_API_KEY;
    await expect(
      adapter.complete({ model: 'gpt-4o-mini', messages: [], temperature: 0.7, maxTokens: 500 }),
    ).rejects.toThrow(ValidationError);
  });

  it('throws when the OpenAI API responds with a non-OK status', async () => {
    process.env.OPENAI_API_KEY = 'sk-test';
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 401, text: () => Promise.resolve('unauthorized') }) as any;

    await expect(
      adapter.complete({ model: 'gpt-4o-mini', messages: [], temperature: 0.7, maxTokens: 500 }),
    ).rejects.toThrow('OpenAI completion failed: 401 unauthorized');
  });

  it('parses content and token usage from a successful response', async () => {
    process.env.OPENAI_API_KEY = 'sk-test';
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          choices: [{ message: { content: 'Hola, ¿en qué te ayudo?' } }],
          usage: { prompt_tokens: 30, completion_tokens: 12 },
        }),
    }) as any;

    const result = await adapter.complete({
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
    process.env.OPENAI_API_KEY = 'sk-test';
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ choices: [{ message: { content: 'hola' } }], usage: {} }),
    }) as any;

    await adapter.complete({ model: 'gpt-4o-mini', messages: [], temperature: 0.7, maxTokens: 500 });

    const [, init] = (global.fetch as jest.Mock).mock.calls[0];
    const body = JSON.parse(init.body);
    expect(body.tools).toBeUndefined();
    expect(body.tool_choice).toBeUndefined();
  });

  it('translates tools into the OpenAI function-calling shape and parses tool_calls back', async () => {
    process.env.OPENAI_API_KEY = 'sk-test';
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
});
