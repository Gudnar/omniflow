import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards, Request, HttpCode } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards';
import { RequirePermission } from '../auth/decorators';
import { ConversationsService } from './conversations.service';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { UpdateConversationStatusDto } from './dto/update-conversation-status.dto';
import { AssignConversationDto } from './dto/assign-conversation.dto';
import { ListConversationsQueryDto } from './dto/list-conversations-query.dto';

@Controller('conversations')
export class ConversationsController {
  constructor(private conversationsService: ConversationsService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  @RequirePermission('conversations.read')
  @HttpCode(200)
  list(@Request() req: any, @Query() query: ListConversationsQueryDto) {
    return this.conversationsService.list(req.user.tenantId, query);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @RequirePermission('conversations.read')
  @HttpCode(200)
  findOne(@Param('id') id: string) {
    return this.conversationsService.findOne(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @RequirePermission('conversations.manage')
  create(@Body() dto: CreateConversationDto) {
    return this.conversationsService.create(dto);
  }

  @Patch(':id/status')
  @UseGuards(JwtAuthGuard)
  @RequirePermission('conversations.manage')
  updateStatus(@Param('id') id: string, @Body() dto: UpdateConversationStatusDto) {
    return this.conversationsService.updateStatus(id, dto);
  }

  @Patch(':id/assign')
  @UseGuards(JwtAuthGuard)
  @RequirePermission('conversations.manage')
  assign(@Param('id') id: string, @Body() dto: AssignConversationDto, @Request() req: any) {
    return this.conversationsService.assign(id, dto, req.user.userId);
  }

  @Post(':id/generate-web-link')
  @UseGuards(JwtAuthGuard)
  @RequirePermission('conversations.manage')
  @HttpCode(201)
  generateWebLink(@Param('id') id: string) {
    return this.conversationsService.generateWebLink(id);
  }
}
