import { AnthropicAdapter } from './anthropic.adapter';
import { ValidationError } from '@omniflow/utils';

describe('AnthropicAdapter', () => {
  let adapter: AnthropicAdapter;
  const originalFetch = global.fetch;

  beforeEach(() => {
    adapter = new AnthropicAdapter();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('throws ValidationError when no apiKey is given', async () => {
    await expect(
      adapter.complete({ apiKey: '', model: 'claude-sonnet-4-5', messages: [], temperature: 0.7, maxTokens: 500 }),
    ).rejects.toThrow(ValidationError);
  });

  it('throws when the Anthropic API responds with a non-OK status', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 401, text: () => Promise.resolve('unauthorized') }) as any;

    await expect(
      adapter.complete({ apiKey: 'sk-ant-test', model: 'claude-sonnet-4-5', messages: [], temperature: 0.7, maxTokens: 500 }),
    ).rejects.toThrow('Anthropic completion failed: 401 unauthorized');
  });

  it('pulls the system message out of `messages` into its own top-level field', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ content: [{ type: 'text', text: 'hola' }], usage: { input_tokens: 1, output_tokens: 1 } }),
    }) as any;

    await adapter.complete({
      apiKey: 'sk-ant-test',
      model: 'claude-sonnet-4-5',
      messages: [
        { role: 'system', content: 'Eres un asistente' },
        { role: 'user', content: 'hola' },
      ],
      temperature: 0.7,
      maxTokens: 500,
    });

    const [, init] = (global.fetch as jest.Mock).mock.calls[0];
    const body = JSON.parse(init.body);
    expect(body.system).toBe('Eres un asistente');
    expect(body.messages).toEqual([{ role: 'user', content: 'hola' }]);
  });

  it('parses content and token usage from a successful response', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          content: [{ type: 'text', text: 'Hola, ¿en qué te ayudo?' }],
          usage: { input_tokens: 30, output_tokens: 12 },
        }),
    }) as any;

    const result = await adapter.complete({
      apiKey: 'sk-ant-test',
      model: 'claude-sonnet-4-5',
      messages: [{ role: 'user', content: 'hola' }],
      temperature: 0.7,
      maxTokens: 500,
    });

    expect(result).toEqual({ content: 'Hola, ¿en qué te ayudo?', promptTokens: 30, completionTokens: 12 });
    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.anthropic.com/v1/messages',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'x-api-key': 'sk-ant-test', 'anthropic-version': '2023-06-01' }),
      }),
    );
  });

  it('translates tools into input_schema and parses tool_use blocks back', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          content: [{ type: 'tool_use', name: 'send_storefront_link', input: { action: 'STORE' } }],
          usage: { input_tokens: 50, output_tokens: 10 },
        }),
    }) as any;

    const result = await adapter.complete({
      apiKey: 'sk-ant-test',
      model: 'claude-sonnet-4-5',
      messages: [{ role: 'user', content: 'quiero comprar' }],
      temperature: 0.7,
      maxTokens: 500,
      tools: [{ name: 'send_storefront_link', description: 'Envía un enlace real', parameters: { type: 'object', properties: {} } }],
    });

    const [, init] = (global.fetch as jest.Mock).mock.calls[0];
    const body = JSON.parse(init.body);
    expect(body.tools).toEqual([
      { name: 'send_storefront_link', description: 'Envía un enlace real', input_schema: { type: 'object', properties: {} } },
    ]);
    expect(result.toolCalls).toEqual([{ name: 'send_storefront_link', arguments: '{"action":"STORE"}' }]);
    expect(result.content).toBe('');
  });
});
