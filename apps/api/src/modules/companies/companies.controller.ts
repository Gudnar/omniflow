import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, Request, HttpCode } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards';
import { RequirePermission } from '../auth/decorators';
import { CompaniesService } from './companies.service';
import { CreateCompanyDto, UpdateCompanyDto } from './companies.dto';

@Controller('companies')
export class CompaniesController {
  constructor(private companiesService: CompaniesService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  @RequirePermission('companies.read')
  @HttpCode(200)
  list(@Request() req: any) {
    return this.companiesService.list(req.user.tenantId);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @RequirePermission('companies.read')
  @HttpCode(200)
  findOne(@Param('id') id: string) {
    return this.companiesService.findOne(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @RequirePermission('companies.manage')
  create(@Body() dto: CreateCompanyDto) {
    return this.companiesService.create(dto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @RequirePermission('companies.manage')
  update(@Param('id') id: string, @Body() dto: UpdateCompanyDto) {
    return this.companiesService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @RequirePermission('companies.manage')
  @HttpCode(200)
  remove(@Param('id') id: string) {
    return this.companiesService.remove(id);
  }
}
