import { Controller, Get, Post, Patch, Body, Param, Request, UseGuards, HttpCode } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards';
import { RequirePermission } from '../auth/decorators';
import { UsersService } from './users.service';
import { CreateUserDto, UpdateUserDto } from './users.dto';

@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  async getMe(@Request() req: any) {
    return this.usersService.getUserById(req.user.userId);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @RequirePermission('users.read')
  @HttpCode(200)
  async listUsers(@Request() req: any) {
    return this.usersService.listUsersByTenant(req.user.tenantId);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @RequirePermission('users.manage')
  async createUser(@Request() req: any, @Body() dto: CreateUserDto) {
    return this.usersService.create(req.user.tenantId, dto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @RequirePermission('users.manage')
  async updateUser(@Request() req: any, @Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.usersService.update(id, req.user.tenantId, dto);
  }
}
