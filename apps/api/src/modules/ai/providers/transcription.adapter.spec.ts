import { TranscriptionAdapter } from './transcription.adapter';
import { ValidationError } from '@omniflow/utils';

describe('TranscriptionAdapter', () => {
  let adapter: TranscriptionAdapter;
  const originalEnv = process.env.OPENAI_API_KEY;
  const originalFetch = global.fetch;

  beforeEach(() => {
    adapter = new TranscriptionAdapter();
  });

  afterEach(() => {
    process.env.OPENAI_API_KEY = originalEnv;
    global.fetch = originalFetch;
  });

  it('throws ValidationError when OPENAI_API_KEY is not set', async () => {
    delete process.env.OPENAI_API_KEY;
    await expect(adapter.transcribe(Buffer.from('x'), 'audio.ogg', 'audio/ogg')).rejects.toThrow(ValidationError);
  });

  it('throws when the OpenAI API responds with a non-OK status', async () => {
    process.env.OPENAI_API_KEY = 'sk-test';
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 400, text: () => Promise.resolve('bad file') }) as any;
    await expect(adapter.transcribe(Buffer.from('x'), 'audio.ogg', 'audio/ogg')).rejects.toThrow(
      'OpenAI transcription failed: 400 bad file',
    );
  });

  it('returns the transcribed text on success', async () => {
    process.env.OPENAI_API_KEY = 'sk-test';
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ text: 'Hola, buenas tardes' }) }) as any;

    const result = await adapter.transcribe(Buffer.from('audio-bytes'), 'audio.ogg', 'audio/ogg');

    expect(result).toBe('Hola, buenas tardes');
    const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toBe('https://api.openai.com/v1/audio/transcriptions');
    expect(init.method).toBe('POST');
    expect(init.headers).toEqual({ Authorization: 'Bearer sk-test' });
    expect(init.body).toBeInstanceOf(FormData);
  });

  it('returns an empty string when the response has no text field', async () => {
    process.env.OPENAI_API_KEY = 'sk-test';
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({}) }) as any;
    const result = await adapter.transcribe(Buffer.from('x'), 'audio.ogg', 'audio/ogg');
    expect(result).toBe('');
  });
});
