import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, HttpCode } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards';
import { RequirePermission } from '../auth/decorators';
import { KnowledgeDocumentsService } from './knowledge-documents.service';
import { CreateKnowledgeDocumentDto, UpdateKnowledgeDocumentDto } from './dto/knowledge-document.dto';

// Grouped under the existing ai.read/ai.manage permissions rather than a new
// pair — a tenant's knowledge base is an AI-agent concern (AI_SPEC.md lists
// "knowledge" as one of the Agent's own properties), not a separate domain.
@Controller('knowledge/documents')
@UseGuards(JwtAuthGuard)
export class KnowledgeDocumentsController {
  constructor(private documentsService: KnowledgeDocumentsService) {}

  @Get()
  @RequirePermission('ai.read')
  @HttpCode(200)
  list() {
    return this.documentsService.list();
  }

  @Get(':id')
  @RequirePermission('ai.read')
  @HttpCode(200)
  findOne(@Param('id') id: string) {
    return this.documentsService.findOne(id);
  }

  @Post()
  @RequirePermission('ai.manage')
  create(@Body() dto: CreateKnowledgeDocumentDto) {
    return this.documentsService.create(dto);
  }

  @Patch(':id')
  @RequirePermission('ai.manage')
  update(@Param('id') id: string, @Body() dto: UpdateKnowledgeDocumentDto) {
    return this.documentsService.update(id, dto);
  }

  @Delete(':id')
  @RequirePermission('ai.manage')
  @HttpCode(200)
  remove(@Param('id') id: string) {
    return this.documentsService.remove(id);
  }
}
