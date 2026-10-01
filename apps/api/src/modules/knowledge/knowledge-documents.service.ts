import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundError } from '@omniflow/utils';
import { CreateKnowledgeDocumentDto, UpdateKnowledgeDocumentDto } from './dto/knowledge-document.dto';
import { EmbeddingsAdapter } from './embeddings.adapter';
import { chunkText } from './chunking';

const DOCUMENT_INCLUDE = { _count: { select: { chunks: true } } };

@Injectable()
export class KnowledgeDocumentsService {
  constructor(
    private prisma: PrismaService,
    private embeddingsAdapter: EmbeddingsAdapter,
  ) {}

  async list() {
    return this.prisma.client.knowledgeDocument.findMany({
      include: DOCUMENT_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const document = await this.prisma.client.knowledgeDocument.findUnique({
      where: { id },
      include: DOCUMENT_INCLUDE,
    });
    if (!document) throw new NotFoundError('KnowledgeDocument');
    return document;
  }

  async create(dto: CreateKnowledgeDocumentDto) {
    const document = await this.prisma.client.knowledgeDocument.create({
      data: { title: dto.title, content: dto.content, status: dto.status },
    });
    await this.reindex(document.id, dto.content);
    return this.findOne(document.id);
  }

  async update(id: string, dto: UpdateKnowledgeDocumentDto) {
    await this.findOne(id);
    const document = await this.prisma.client.knowledgeDocument.update({
      where: { id },
      data: { title: dto.title, content: dto.content, status: dto.status },
    });
    // Only worth the embeddings-API round trip when the text actually
    // changed — a plain status/title toggle shouldn't re-embed anything.
    if (dto.content !== undefined) {
      await this.reindex(id, document.content);
    }
    return this.findOne(id);
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.client.knowledgeDocument.delete({ where: { id } });
    return { success: true };
  }

  // Re-chunks and re-embeds a document from scratch — simplest correct
  // approach for this phase's document sizes; no incremental diffing.
  private async reindex(documentId: string, content: string) {
    await this.prisma.client.knowledgeChunk.deleteMany({ where: { documentId } });

    const chunks = chunkText(content);
    if (!chunks.length) return;

    const embeddings = await this.embeddingsAdapter.embed(chunks);

    await this.prisma.client.knowledgeChunk.createMany({
      data: chunks.map((chunkContent, index) => ({
        documentId,
        content: chunkContent,
        chunkIndex: index,
        embedding: embeddings[index],
      })),
    });
  }
}
