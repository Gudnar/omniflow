import { Controller, Get, Post, Body, Param, UseGuards, Request, HttpCode } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards';
import { RequirePermission } from '../auth/decorators';
import { MessagesService } from './messages.service';
import { CreateMessageDto } from './dto/create-message.dto';

@Controller('conversations/:conversationId/messages')
export class MessagesController {
  constructor(private messagesService: MessagesService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  @RequirePermission('conversations.read')
  @HttpCode(200)
  list(@Param('conversationId') conversationId: string) {
    return this.messagesService.list(conversationId);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @RequirePermission('conversations.manage')
  create(
    @Param('conversationId') conversationId: string,
    @Request() req: any,
    @Body() dto: CreateMessageDto,
  ) {
    return this.messagesService.create(conversationId, req.user.userId, dto);
  }
}
