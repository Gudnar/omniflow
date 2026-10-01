// Fixed-size chunking with a small overlap so a sentence split across a
// chunk boundary still appears whole in at least one chunk. No semantic/
// paragraph-aware splitting — simple and good enough for the short FAQ/
// policy-style documents this phase targets.
const CHUNK_SIZE = 800;
const CHUNK_OVERLAP = 100;

export function chunkText(text: string): string[] {
  const clean = text.trim().replace(/\s+/g, ' ');
  if (!clean) return [];

  const chunks: string[] = [];
  let start = 0;
  while (start < clean.length) {
    const end = Math.min(start + CHUNK_SIZE, clean.length);
    chunks.push(clean.slice(start, end).trim());
    if (end === clean.length) break;
    start = end - CHUNK_OVERLAP;
  }
  return chunks.filter(Boolean);
}

export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}
