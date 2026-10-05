import { Injectable } from '@nestjs/common';
import { ValidationError } from '@omniflow/utils';

// Same "one real adapter, fetch-based" shape as openai.adapter.ts /
// embeddings.adapter.ts. Whisper via multipart/form-data — Node 18's global
// fetch/FormData/Blob (undici) handle this natively, no SDK needed.
@Injectable()
export class TranscriptionAdapter {
  async transcribe(apiKey: string, buffer: Buffer, filename: string, mimeType: string): Promise<string> {
    if (!apiKey) {
      throw new ValidationError('OpenAI is not configured for this tenant');
    }

    const formData = new FormData();
    formData.append('file', new Blob([buffer], { type: mimeType }), filename);
    formData.append('model', 'whisper-1');

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: formData,
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(`OpenAI transcription failed: ${response.status} ${text}`);
    }

    const data: any = await response.json();
    return data.text ?? '';
  }
}
