import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, HttpCode } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards';
import { RequirePermission } from '../auth/decorators';
import { TemplatesService } from './templates.service';
import { CreateTemplateDto, UpdateTemplateDto, ListTemplatesQueryDto } from './dto/template.dto';

@Controller('templates')
export class TemplatesController {
  constructor(private templatesService: TemplatesService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  @RequirePermission('templates.read')
  @HttpCode(200)
  list(@Query() query: ListTemplatesQueryDto) {
    return this.templatesService.list(query);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @RequirePermission('templates.read')
  @HttpCode(200)
  findOne(@Param('id') id: string) {
    return this.templatesService.findOne(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @RequirePermission('templates.manage')
  create(@Body() dto: CreateTemplateDto) {
    return this.templatesService.create(dto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @RequirePermission('templates.manage')
  update(@Param('id') id: string, @Body() dto: UpdateTemplateDto) {
    return this.templatesService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @RequirePermission('templates.manage')
  @HttpCode(200)
  remove(@Param('id') id: string) {
    return this.templatesService.remove(id);
  }

  @Post(':id/submit')
  @UseGuards(JwtAuthGuard)
  @RequirePermission('templates.manage')
  submit(@Param('id') id: string) {
    return this.templatesService.submit(id);
  }

  @Post(':id/sync-status')
  @UseGuards(JwtAuthGuard)
  @RequirePermission('templates.manage')
  syncStatus(@Param('id') id: string) {
    return this.templatesService.syncStatus(id);
  }
}
