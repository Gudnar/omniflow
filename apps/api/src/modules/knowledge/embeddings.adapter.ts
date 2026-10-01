import { Injectable } from '@nestjs/common';
import { ValidationError } from '@omniflow/utils';

// Same "one real adapter, fetch-based" shape as ai/providers/openai.adapter.ts.
// text-embedding-3-small: 1536-dim vectors, cheap, more than enough for a
// per-tenant knowledge base at this phase's scale.
const EMBEDDING_MODEL = 'text-embedding-3-small';

@Injectable()
export class EmbeddingsAdapter {
  async embed(texts: string[]): Promise<number[][]> {
    if (!texts.length) return [];

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new ValidationError('OpenAI is not configured (missing OPENAI_API_KEY)');
    }

    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ model: EMBEDDING_MODEL, input: texts }),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(`OpenAI embeddings failed: ${response.status} ${text}`);
    }

    const data: any = await response.json();
    return data.data.map((d: any) => d.embedding);
  }
}
