import { Controller, Get, Post, Body, Param, UseGuards, Request, HttpCode } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards';
import { RequirePermission } from '../auth/decorators';
import { InventoryTransfersService } from './inventory-transfers.service';
import { CreateTransferDto } from './dto/inventory-transfer.dto';

@Controller('inventory-transfers')
export class InventoryTransfersController {
  constructor(private transfersService: InventoryTransfersService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  @RequirePermission('products.read')
  @HttpCode(200)
  list() {
    return this.transfersService.list();
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @RequirePermission('products.read')
  @HttpCode(200)
  findOne(@Param('id') id: string) {
    return this.transfersService.findOne(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @RequirePermission('products.manage')
  create(@Request() req: any, @Body() dto: CreateTransferDto) {
    return this.transfersService.create(req.user.tenantId, req.user.userId, dto);
  }

  @Post(':id/complete')
  @UseGuards(JwtAuthGuard)
  @RequirePermission('products.manage')
  @HttpCode(200)
  complete(@Request() req: any, @Param('id') id: string) {
    return this.transfersService.complete(req.user.tenantId, id);
  }

  @Post(':id/cancel')
  @UseGuards(JwtAuthGuard)
  @RequirePermission('products.manage')
  @HttpCode(200)
  cancel(@Param('id') id: string) {
    return this.transfersService.cancel(id);
  }
}
