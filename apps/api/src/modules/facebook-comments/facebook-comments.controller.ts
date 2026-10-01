import { Controller, Get, Post, Body, Param, UseGuards, HttpCode } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards';
import { RequirePermission } from '../auth/decorators';
import { FacebookCommentsService } from './facebook-comments.service';
import { ReplyCommentDto } from './dto/reply-comment.dto';

@Controller('facebook-comments')
@UseGuards(JwtAuthGuard)
export class FacebookCommentsController {
  constructor(private facebookCommentsService: FacebookCommentsService) {}

  @Get('posts')
  @RequirePermission('comments.read')
  @HttpCode(200)
  list() {
    return this.facebookCommentsService.list();
  }

  @Post(':commentId/reply')
  @RequirePermission('comments.manage')
  reply(@Param('commentId') commentId: string, @Body() dto: ReplyCommentDto) {
    return this.facebookCommentsService.reply(commentId, dto);
  }
}
