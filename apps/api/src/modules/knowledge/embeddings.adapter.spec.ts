import { EmbeddingsAdapter } from './embeddings.adapter';
import { ValidationError } from '@omniflow/utils';

describe('EmbeddingsAdapter', () => {
  let adapter: EmbeddingsAdapter;
  const originalEnv = process.env.OPENAI_API_KEY;
  const originalFetch = global.fetch;

  beforeEach(() => {
    adapter = new EmbeddingsAdapter();
  });

  afterEach(() => {
    process.env.OPENAI_API_KEY = originalEnv;
    global.fetch = originalFetch;
  });

  it('returns an empty array without calling the API when given no texts', async () => {
    global.fetch = jest.fn();
    const result = await adapter.embed([]);
    expect(result).toEqual([]);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('throws ValidationError when OPENAI_API_KEY is not set', async () => {
    delete process.env.OPENAI_API_KEY;
    await expect(adapter.embed(['hola'])).rejects.toThrow(ValidationError);
  });

  it('throws when the OpenAI API responds with a non-OK status', async () => {
    process.env.OPENAI_API_KEY = 'sk-test';
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 401, text: () => Promise.resolve('unauthorized') }) as any;
    await expect(adapter.embed(['hola'])).rejects.toThrow('OpenAI embeddings failed: 401 unauthorized');
  });

  it('returns the embedding vectors in the same order as the input texts', async () => {
    process.env.OPENAI_API_KEY = 'sk-test';
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          data: [
            { embedding: [0.1, 0.2] },
            { embedding: [0.3, 0.4] },
          ],
        }),
    }) as any;

    const result = await adapter.embed(['uno', 'dos']);

    expect(result).toEqual([[0.1, 0.2], [0.3, 0.4]]);
    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.openai.com/v1/embeddings',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer sk-test' }),
        body: JSON.stringify({ model: 'text-embedding-3-small', input: ['uno', 'dos'] }),
      }),
    );
  });
});
