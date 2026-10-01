import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { KnowledgeDocumentsController } from './knowledge-documents.controller';
import { KnowledgeDocumentsService } from './knowledge-documents.service';
import { KnowledgeSearchService } from './knowledge-search.service';
import { EmbeddingsAdapter } from './embeddings.adapter';

@Module({
  imports: [PrismaModule],
  controllers: [KnowledgeDocumentsController],
  providers: [KnowledgeDocumentsService, KnowledgeSearchService, EmbeddingsAdapter],
  exports: [KnowledgeSearchService],
})
export class KnowledgeModule {}
