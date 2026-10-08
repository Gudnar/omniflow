import { Controller, Get, Post, Patch, Delete, Body, Param, Request, UseGuards, HttpCode } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards';
import { RequirePermission } from '../auth/decorators';
import { RolesService } from './roles.service';
import { CreateRoleDto, UpdateRoleDto } from './roles.dto';

@Controller('roles')
export class RolesController {
  constructor(private rolesService: RolesService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  @RequirePermission('roles.read')
  @HttpCode(200)
  list() {
    return this.rolesService.list();
  }

  @Get('permissions-catalog')
  @UseGuards(JwtAuthGuard)
  @RequirePermission('roles.read')
  @HttpCode(200)
  getPermissionsCatalog() {
    return this.rolesService.getPermissionsCatalog();
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @RequirePermission('roles.manage')
  create(@Request() req: any, @Body() dto: CreateRoleDto) {
    return this.rolesService.create(req.user.tenantId, dto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @RequirePermission('roles.manage')
  update(@Param('id') id: string, @Body() dto: UpdateRoleDto) {
    return this.rolesService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @RequirePermission('roles.manage')
  @HttpCode(200)
  delete(@Param('id') id: string) {
    return this.rolesService.delete(id);
  }
}
