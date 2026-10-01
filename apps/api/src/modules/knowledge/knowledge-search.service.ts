import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmbeddingsAdapter } from './embeddings.adapter';
import { cosineSimilarity } from './chunking';

const TOP_K = 4;
// text-embedding-3-small cosine similarity between a short question and a
// genuinely relevant paragraph typically lands around 0.4-0.6, not 0.8+ —
// verified empirically (a real "envío a domicilio" question against its
// matching policy paragraph scored 0.48). A high threshold silently drops
// good matches. This floor only filters out near-orthogonal noise; the
// system prompt itself also tells the model to ignore an irrelevant chunk.
const MIN_SIMILARITY = 0.3;

@Injectable()
export class KnowledgeSearchService {
  constructor(
    private prisma: PrismaService,
    private embeddingsAdapter: EmbeddingsAdapter,
  ) {}

  // RAG retrieval — strictly scoped to the tenant (via the ambient
  // tenant-scoped prisma client, same as everywhere else) AND to the
  // specific documents this agent was given (AiAgentKnowledgeDocument), so
  // one agent never leaks another agent's knowledge base within the tenant.
  async search(agentId: string, queryText: string): Promise<string[]> {
    const links = await this.prisma.client.aiAgentKnowledgeDocument.findMany({
      where: { agentId, document: { status: 'ACTIVE' } },
      select: { documentId: true },
    });
    if (!links.length) return [];

    const documentIds = links.map((l: any) => l.documentId);
    const chunks = await this.prisma.client.knowledgeChunk.findMany({
      where: { documentId: { in: documentIds } },
    });
    if (!chunks.length) return [];

    const [queryEmbedding] = await this.embeddingsAdapter.embed([queryText]);

    const scored = chunks
      .map((chunk: any) => ({ content: chunk.content, score: cosineSimilarity(queryEmbedding, chunk.embedding as number[]) }))
      .filter((c: any) => c.score >= MIN_SIMILARITY)
      .sort((a: any, b: any) => b.score - a.score)
      .slice(0, TOP_K);

    return scored.map((c: any) => c.content);
  }
}
