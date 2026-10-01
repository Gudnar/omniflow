import { KnowledgeSearchService } from './knowledge-search.service';

describe('KnowledgeSearchService', () => {
  let service: KnowledgeSearchService;
  let prisma: any;
  let embeddingsAdapter: any;

  beforeEach(() => {
    prisma = {
      client: {
        aiAgentKnowledgeDocument: { findMany: jest.fn().mockResolvedValue([]) },
        knowledgeChunk: { findMany: jest.fn().mockResolvedValue([]) },
      },
    };
    embeddingsAdapter = { embed: jest.fn() };
    service = new KnowledgeSearchService(prisma, embeddingsAdapter);
  });

  it('returns an empty array without embedding anything when the agent has no linked documents', async () => {
    prisma.client.aiAgentKnowledgeDocument.findMany.mockResolvedValue([]);
    const result = await service.search('agent-1', '¿Cuál es el horario?');
    expect(result).toEqual([]);
    expect(embeddingsAdapter.embed).not.toHaveBeenCalled();
  });

  it('only considers documents linked to the agent and still ACTIVE', async () => {
    prisma.client.aiAgentKnowledgeDocument.findMany.mockResolvedValue([{ documentId: 'doc1' }]);
    prisma.client.knowledgeChunk.findMany.mockResolvedValue([]);

    await service.search('agent-1', 'hola');

    expect(prisma.client.aiAgentKnowledgeDocument.findMany).toHaveBeenCalledWith({
      where: { agentId: 'agent-1', document: { status: 'ACTIVE' } },
      select: { documentId: true },
    });
  });

  it('returns the top matching chunks above the similarity threshold, sorted best-first', async () => {
    prisma.client.aiAgentKnowledgeDocument.findMany.mockResolvedValue([{ documentId: 'doc1' }]);
    prisma.client.knowledgeChunk.findMany.mockResolvedValue([
      { content: 'Chunk poco relevante', embedding: [1, 0] },
      { content: 'Chunk muy relevante', embedding: [0, 1] },
      { content: 'Chunk irrelevante', embedding: [-1, 0] },
    ]);
    embeddingsAdapter.embed.mockResolvedValue([[0, 1]]);

    const result = await service.search('agent-1', '¿horario?');

    expect(result).toEqual(['Chunk muy relevante']);
  });

  it('returns an empty array when no chunk clears the similarity threshold', async () => {
    prisma.client.aiAgentKnowledgeDocument.findMany.mockResolvedValue([{ documentId: 'doc1' }]);
    prisma.client.knowledgeChunk.findMany.mockResolvedValue([{ content: 'Nada que ver', embedding: [1, 0] }]);
    embeddingsAdapter.embed.mockResolvedValue([[0, 1]]);

    const result = await service.search('agent-1', '¿horario?');

    expect(result).toEqual([]);
  });
});
