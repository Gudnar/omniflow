import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, HttpCode } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards';
import { RequirePermission } from '../auth/decorators';
import { SegmentsService } from './segments.service';
import { CreateSegmentDto, UpdateSegmentDto } from './dto/segment.dto';

@Controller('segments')
export class SegmentsController {
  constructor(private segmentsService: SegmentsService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  @RequirePermission('campaigns.read')
  @HttpCode(200)
  list() {
    return this.segmentsService.list();
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @RequirePermission('campaigns.read')
  @HttpCode(200)
  findOne(@Param('id') id: string) {
    return this.segmentsService.findOne(id);
  }

  @Get(':id/preview-count')
  @UseGuards(JwtAuthGuard)
  @RequirePermission('campaigns.read')
  @HttpCode(200)
  async previewCount(@Param('id') id: string) {
    return { count: await this.segmentsService.previewCount(id) };
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @RequirePermission('campaigns.manage')
  create(@Body() dto: CreateSegmentDto) {
    return this.segmentsService.create(dto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @RequirePermission('campaigns.manage')
  update(@Param('id') id: string, @Body() dto: UpdateSegmentDto) {
    return this.segmentsService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @RequirePermission('campaigns.manage')
  @HttpCode(200)
  remove(@Param('id') id: string) {
    return this.segmentsService.remove(id);
  }
}
