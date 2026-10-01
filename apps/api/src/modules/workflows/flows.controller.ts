import { Controller, Get, Post, Patch, Delete, Body, Param, Query, Request, UseGuards, HttpCode } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards';
import { RequirePermission } from '../auth/decorators';
import { FlowsService } from './flows.service';
import { CreateFlowDto, UpdateFlowDto, TestRunDto, ListFlowsQueryDto, ListExecutionsQueryDto } from './dto/flow.dto';

@Controller('workflows/flows')
export class FlowsController {
  constructor(private flowsService: FlowsService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  @RequirePermission('workflows.read')
  @HttpCode(200)
  list(@Query() query: ListFlowsQueryDto) {
    return this.flowsService.list(query);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @RequirePermission('workflows.read')
  @HttpCode(200)
  findOne(@Param('id') id: string) {
    return this.flowsService.findOne(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @RequirePermission('workflows.manage')
  create(@Request() req: any, @Body() dto: CreateFlowDto) {
    return this.flowsService.create(dto, req.user.userId);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @RequirePermission('workflows.manage')
  update(@Param('id') id: string, @Body() dto: UpdateFlowDto) {
    return this.flowsService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @RequirePermission('workflows.manage')
  @HttpCode(200)
  remove(@Param('id') id: string) {
    return this.flowsService.remove(id);
  }

  @Post(':id/test-run')
  @UseGuards(JwtAuthGuard)
  @RequirePermission('workflows.manage')
  testRun(@Param('id') id: string, @Body() dto: TestRunDto) {
    return this.flowsService.testRun(id, dto);
  }

  @Get(':id/executions')
  @UseGuards(JwtAuthGuard)
  @RequirePermission('workflows.read')
  @HttpCode(200)
  listExecutions(@Param('id') id: string, @Query() query: ListExecutionsQueryDto) {
    return this.flowsService.listExecutions(id, query);
  }
}

@Controller('workflows/executions')
export class FlowExecutionsController {
  constructor(private flowsService: FlowsService) {}

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @RequirePermission('workflows.read')
  @HttpCode(200)
  getExecution(@Param('id') id: string) {
    return this.flowsService.getExecution(id);
  }
}
