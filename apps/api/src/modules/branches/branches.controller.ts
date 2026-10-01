import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, Request, HttpCode } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards';
import { RequirePermission } from '../auth/decorators';
import { BranchesService } from './branches.service';
import { CreateBranchDto, UpdateBranchDto } from './branches.dto';

@Controller('branches')
export class BranchesController {
  constructor(private branchesService: BranchesService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  @RequirePermission('branches.read')
  @HttpCode(200)
  list(@Request() req: any) {
    return this.branchesService.list(req.user.tenantId);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @RequirePermission('branches.manage')
  create(@Body() dto: CreateBranchDto) {
    return this.branchesService.create(dto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @RequirePermission('branches.manage')
  update(@Param('id') id: string, @Body() dto: UpdateBranchDto) {
    return this.branchesService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @RequirePermission('branches.manage')
  @HttpCode(200)
  deactivate(@Param('id') id: string) {
    return this.branchesService.deactivate(id);
  }
}
