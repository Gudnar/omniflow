import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, HttpCode } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards';
import { RequirePermission } from '../auth/decorators';
import { AiAgentsService } from './ai-agents.service';
import { CreateAiAgentDto, UpdateAiAgentDto } from './dto/ai-agent.dto';

@Controller('ai/agents')
@UseGuards(JwtAuthGuard)
export class AiAgentsController {
  constructor(private agentsService: AiAgentsService) {}

  @Get()
  @RequirePermission('ai.read')
  @HttpCode(200)
  list() {
    return this.agentsService.list();
  }

  @Get(':id')
  @RequirePermission('ai.read')
  @HttpCode(200)
  findOne(@Param('id') id: string) {
    return this.agentsService.findOne(id);
  }

  @Post()
  @RequirePermission('ai.manage')
  create(@Body() dto: CreateAiAgentDto) {
    return this.agentsService.create(dto);
  }

  @Patch(':id')
  @RequirePermission('ai.manage')
  update(@Param('id') id: string, @Body() dto: UpdateAiAgentDto) {
    return this.agentsService.update(id, dto);
  }

  @Delete(':id')
  @RequirePermission('ai.manage')
  @HttpCode(200)
  remove(@Param('id') id: string) {
    return this.agentsService.remove(id);
  }
}
