import { Controller, Get, UseGuards, Request, HttpCode } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards';
import { RequirePermission } from '../auth/decorators';
import { UsersService } from './users.service';

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
}
