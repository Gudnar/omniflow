import { KnowledgeDocumentsService } from './knowledge-documents.service';
import { NotFoundError } from '@omniflow/utils';

describe('KnowledgeDocumentsService', () => {
  let service: KnowledgeDocumentsService;
  let prisma: any;
  let embeddingsAdapter: any;

  beforeEach(() => {
    prisma = {
      client: {
        knowledgeDocument: { findMany: jest.fn(), findUnique: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn() },
        knowledgeChunk: { deleteMany: jest.fn(), createMany: jest.fn() },
      },
    };
    embeddingsAdapter = { embed: jest.fn() };
    service = new KnowledgeDocumentsService(prisma, embeddingsAdapter);
  });

  describe('create', () => {
    it('creates the document, chunks and embeds its content, then returns it with counts', async () => {
      prisma.client.knowledgeDocument.create.mockResolvedValue({ id: 'd1' });
      embeddingsAdapter.embed.mockResolvedValue([[0.1, 0.2]]);
      prisma.client.knowledgeDocument.findUnique.mockResolvedValue({ id: 'd1', title: 'FAQ', _count: { chunks: 1 } });

      const result = await service.create({ title: 'FAQ', content: 'Horario: 9am-7pm' } as any);

      expect(prisma.client.knowledgeDocument.create).toHaveBeenCalledWith({
        data: { title: 'FAQ', content: 'Horario: 9am-7pm', status: undefined },
      });
      expect(embeddingsAdapter.embed).toHaveBeenCalledWith(['Horario: 9am-7pm']);
      expect(prisma.client.knowledgeChunk.createMany).toHaveBeenCalledWith({
        data: [{ documentId: 'd1', content: 'Horario: 9am-7pm', chunkIndex: 0, embedding: [0.1, 0.2] }],
      });
      expect(result).toEqual({ id: 'd1', title: 'FAQ', _count: { chunks: 1 } });
    });

    it('does not call the embeddings API for blank content', async () => {
      prisma.client.knowledgeDocument.create.mockResolvedValue({ id: 'd1' });
      prisma.client.knowledgeDocument.findUnique.mockResolvedValue({ id: 'd1' });

      await service.create({ title: 'Empty', content: '   ' } as any);

      expect(embeddingsAdapter.embed).not.toHaveBeenCalled();
      expect(prisma.client.knowledgeChunk.createMany).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('throws NotFoundError when the document does not exist', async () => {
      prisma.client.knowledgeDocument.findUnique.mockResolvedValue(null);
      await expect(service.update('missing', { title: 'X' } as any)).rejects.toThrow(NotFoundError);
    });

    it('re-chunks and re-embeds when content changes, deleting old chunks first', async () => {
      prisma.client.knowledgeDocument.findUnique
        .mockResolvedValueOnce({ id: 'd1' }) // findOne guard at the top of update()
        .mockResolvedValueOnce({ id: 'd1' }); // findOne at the end, after reindex
      prisma.client.knowledgeDocument.update.mockResolvedValue({ id: 'd1', content: 'Nuevo contenido' });
      embeddingsAdapter.embed.mockResolvedValue([[0.5, 0.5]]);

      await service.update('d1', { content: 'Nuevo contenido' } as any);

      expect(prisma.client.knowledgeChunk.deleteMany).toHaveBeenCalledWith({ where: { documentId: 'd1' } });
      expect(embeddingsAdapter.embed).toHaveBeenCalledWith(['Nuevo contenido']);
    });

    it('does not re-embed when only the title or status changes', async () => {
      prisma.client.knowledgeDocument.findUnique.mockResolvedValue({ id: 'd1' });
      prisma.client.knowledgeDocument.update.mockResolvedValue({ id: 'd1' });

      await service.update('d1', { title: 'Renamed' } as any);

      expect(embeddingsAdapter.embed).not.toHaveBeenCalled();
      expect(prisma.client.knowledgeChunk.deleteMany).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('throws NotFoundError when the document does not exist', async () => {
      prisma.client.knowledgeDocument.findUnique.mockResolvedValue(null);
      await expect(service.remove('missing')).rejects.toThrow(NotFoundError);
    });

    it('removes an existing document (cascades to its chunks via the FK)', async () => {
      prisma.client.knowledgeDocument.findUnique.mockResolvedValue({ id: 'd1' });
      await expect(service.remove('d1')).resolves.toEqual({ success: true });
    });
  });
});
