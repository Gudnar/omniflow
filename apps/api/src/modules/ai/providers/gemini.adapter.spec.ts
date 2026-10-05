import { GeminiAdapter } from './gemini.adapter';
import { ValidationError } from '@omniflow/utils';

describe('GeminiAdapter', () => {
  let adapter: GeminiAdapter;
  const originalFetch = global.fetch;

  beforeEach(() => {
    adapter = new GeminiAdapter();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('throws ValidationError when no apiKey is given', async () => {
    await expect(
      adapter.complete({ apiKey: '', model: 'gemini-2.0-flash', messages: [], temperature: 0.7, maxTokens: 500 }),
    ).rejects.toThrow(ValidationError);
  });

  it('throws when the Gemini API responds with a non-OK status', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 400, text: () => Promise.resolve('bad request') }) as any;

    await expect(
      adapter.complete({ apiKey: 'gem-test', model: 'gemini-2.0-flash', messages: [], temperature: 0.7, maxTokens: 500 }),
    ).rejects.toThrow('Gemini completion failed: 400 bad request');
  });

  it('puts the api key in the URL and maps assistant turns to role "model"', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ candidates: [{ content: { parts: [{ text: 'hola' }] } }] }),
    }) as any;

    await adapter.complete({
      apiKey: 'gem-test',
      model: 'gemini-2.0-flash',
      messages: [
        { role: 'system', content: 'Eres un asistente' },
        { role: 'user', content: 'hola' },
        { role: 'assistant', content: 'hola, bienvenido' },
      ],
      temperature: 0.7,
      maxTokens: 500,
    });

    const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toBe('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=gem-test');
    const body = JSON.parse(init.body);
    expect(body.systemInstruction).toEqual({ parts: [{ text: 'Eres un asistente' }] });
    expect(body.contents).toEqual([
      { role: 'user', parts: [{ text: 'hola' }] },
      { role: 'model', parts: [{ text: 'hola, bienvenido' }] },
    ]);
  });

  it('parses content and token usage from a successful response', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          candidates: [{ content: { parts: [{ text: 'Hola, ¿en qué te ayudo?' }] } }],
          usageMetadata: { promptTokenCount: 30, candidatesTokenCount: 12 },
        }),
    }) as any;

    const result = await adapter.complete({
      apiKey: 'gem-test',
      model: 'gemini-2.0-flash',
      messages: [{ role: 'user', content: 'hola' }],
      temperature: 0.7,
      maxTokens: 500,
    });

    expect(result).toEqual({ content: 'Hola, ¿en qué te ayudo?', promptTokens: 30, completionTokens: 12 });
  });

  it('translates tools into functionDeclarations and parses functionCall parts back', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          candidates: [{ content: { parts: [{ functionCall: { name: 'send_storefront_link', args: { action: 'STORE' } } }] } }],
          usageMetadata: { promptTokenCount: 50, candidatesTokenCount: 10 },
        }),
    }) as any;

    const result = await adapter.complete({
      apiKey: 'gem-test',
      model: 'gemini-2.0-flash',
      messages: [{ role: 'user', content: 'quiero comprar' }],
      temperature: 0.7,
      maxTokens: 500,
      tools: [{ name: 'send_storefront_link', description: 'Envía un enlace real', parameters: { type: 'object', properties: {} } }],
    });

    const [, init] = (global.fetch as jest.Mock).mock.calls[0];
    const body = JSON.parse(init.body);
    expect(body.tools).toEqual([
      { functionDeclarations: [{ name: 'send_storefront_link', description: 'Envía un enlace real', parameters: { type: 'object', properties: {} } }] },
    ]);
    expect(result.toolCalls).toEqual([{ name: 'send_storefront_link', arguments: '{"action":"STORE"}' }]);
  });
});
