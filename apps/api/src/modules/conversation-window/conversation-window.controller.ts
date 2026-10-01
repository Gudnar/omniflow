import { Controller, Get, Post, Param, Body, HttpCode } from '@nestjs/common';
import { Public } from '../auth/decorators';
import { ConversationWindowService } from './conversation-window.service';
import { SendWindowMessageDto } from './dto/send-window-message.dto';

@Controller('conversation-window')
@Public()
export class ConversationWindowController {
  constructor(private conversationWindowService: ConversationWindowService) {}

  @Get(':token')
  @HttpCode(200)
  getWindow(@Param('token') token: string) {
    return this.conversationWindowService.getWindow(token);
  }

  @Post(':token/messages')
  @HttpCode(201)
  sendMessage(@Param('token') token: string, @Body() dto: SendWindowMessageDto) {
    return this.conversationWindowService.sendMessage(token, dto.content);
  }
}
