import { Controller, Get, Post, Body, Param, UseGuards, Request, HttpCode } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards';
import { RequirePermission } from '../auth/decorators';
import { CommerceSessionsService } from './commerce-sessions.service';
import { CreateSessionDto, SessionLocationDto } from './dto/commerce-session.dto';

@Controller('commerce/sessions')
export class CommerceSessionsController {
  constructor(private sessionsService: CommerceSessionsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @RequirePermission('commerce.manage')
  create(@Request() req: any, @Body() dto: CreateSessionDto) {
    return this.sessionsService.create(req.user.tenantId, dto);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @RequirePermission('commerce.read')
  @HttpCode(200)
  findOne(@Param('id') id: string) {
    return this.sessionsService.findOne(id);
  }

  @Post(':id/cart')
  @UseGuards(JwtAuthGuard)
  @RequirePermission('commerce.manage')
  getOrCreateCart(@Param('id') id: string) {
    return this.sessionsService.getOrCreateCart(id);
  }

  @Post(':id/location')
  @UseGuards(JwtAuthGuard)
  @RequirePermission('commerce.manage')
  recordLocation(@Param('id') id: string, @Body() dto: SessionLocationDto) {
    return this.sessionsService.recordLocation(id, dto);
  }
}
