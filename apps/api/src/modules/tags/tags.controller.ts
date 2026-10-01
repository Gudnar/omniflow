import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, Request, HttpCode } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards';
import { RequirePermission } from '../auth/decorators';
import { TagsService } from './tags.service';
import { CreateTagDto, UpdateTagDto } from './tags.dto';

@Controller('tags')
export class TagsController {
  constructor(private tagsService: TagsService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  @RequirePermission('tags.read')
  @HttpCode(200)
  list(@Request() req: any) {
    return this.tagsService.list(req.user.tenantId);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @RequirePermission('tags.manage')
  create(@Body() dto: CreateTagDto) {
    return this.tagsService.create(dto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @RequirePermission('tags.manage')
  update(@Param('id') id: string, @Body() dto: UpdateTagDto) {
    return this.tagsService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @RequirePermission('tags.manage')
  @HttpCode(200)
  remove(@Param('id') id: string) {
    return this.tagsService.remove(id);
  }
}
