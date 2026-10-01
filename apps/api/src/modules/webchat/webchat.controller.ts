import { Controller, Get, Post, Param, Query, Body, HttpCode } from '@nestjs/common';
import { Public } from '../auth/decorators';
import { WebchatService } from './webchat.service';
import { SendWebchatMessageDto } from './dto/webchat.dto';

@Controller('webchat')
@Public()
export class WebchatController {
  constructor(private webchatService: WebchatService) {}

  @Post(':linkPageSlug/start')
  @HttpCode(201)
  start(@Param('linkPageSlug') linkPageSlug: string) {
    return this.webchatService.start(linkPageSlug);
  }

  @Post('store/:storeSlug/start')
  @HttpCode(201)
  startFromStore(@Param('storeSlug') storeSlug: string) {
    return this.webchatService.startFromStore(storeSlug);
  }

  @Post('conversations/:id/messages')
  @HttpCode(201)
  sendMessage(@Param('id') id: string, @Body() dto: SendWebchatMessageDto) {
    return this.webchatService.sendMessage(id, dto.webchatToken, dto.content);
  }

  @Get('conversations/:id/messages')
  @HttpCode(200)
  listMessages(@Param('id') id: string, @Query('webchatToken') webchatToken: string) {
    return this.webchatService.listMessages(id, webchatToken);
  }
}
