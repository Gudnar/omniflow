import { chunkText, cosineSimilarity } from './chunking';

describe('chunkText', () => {
  it('returns an empty array for blank input', () => {
    expect(chunkText('   ')).toEqual([]);
    expect(chunkText('')).toEqual([]);
  });

  it('returns a single chunk for short text', () => {
    expect(chunkText('Hola, este es un texto corto.')).toEqual(['Hola, este es un texto corto.']);
  });

  it('splits long text into overlapping chunks', () => {
    const text = 'a'.repeat(1000);
    const chunks = chunkText(text);
    expect(chunks.length).toBeGreaterThan(1);
    // Consecutive chunks overlap by CHUNK_OVERLAP characters.
    expect(chunks[0].slice(-50)).toBe(chunks[1].slice(0, 50));
  });

  it('collapses internal whitespace', () => {
    expect(chunkText('Hola   mundo\n\ncómo   estás')).toEqual(['Hola mundo cómo estás']);
  });
});

describe('cosineSimilarity', () => {
  it('returns 1 for identical vectors', () => {
    expect(cosineSimilarity([1, 2, 3], [1, 2, 3])).toBeCloseTo(1);
  });

  it('returns 0 for orthogonal vectors', () => {
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0);
  });

  it('returns 0 when either vector is all zeros', () => {
    expect(cosineSimilarity([0, 0], [1, 2])).toBe(0);
  });
});
