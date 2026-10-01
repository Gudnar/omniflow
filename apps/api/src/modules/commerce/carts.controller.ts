import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, HttpCode } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards';
import { RequirePermission } from '../auth/decorators';
import { CartsService } from './carts.service';
import { AddCartItemDto, UpdateCartItemDto, UpdateCartDto, CheckoutDto } from './dto/cart.dto';

@Controller('carts')
export class CartsController {
  constructor(private cartsService: CartsService) {}

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @RequirePermission('commerce.read')
  @HttpCode(200)
  findOne(@Param('id') id: string) {
    return this.cartsService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @RequirePermission('commerce.manage')
  updateBranch(@Param('id') id: string, @Body() dto: UpdateCartDto) {
    return this.cartsService.updateBranch(id, dto.branchId);
  }

  @Post(':id/items')
  @UseGuards(JwtAuthGuard)
  @RequirePermission('commerce.manage')
  addItem(@Param('id') id: string, @Body() dto: AddCartItemDto) {
    return this.cartsService.addItem(id, dto);
  }

  @Patch(':id/items/:itemId')
  @UseGuards(JwtAuthGuard)
  @RequirePermission('commerce.manage')
  updateItem(@Param('id') id: string, @Param('itemId') itemId: string, @Body() dto: UpdateCartItemDto) {
    return this.cartsService.updateItem(id, itemId, dto);
  }

  @Delete(':id/items/:itemId')
  @UseGuards(JwtAuthGuard)
  @RequirePermission('commerce.manage')
  @HttpCode(200)
  removeItem(@Param('id') id: string, @Param('itemId') itemId: string) {
    return this.cartsService.removeItem(id, itemId);
  }

  @Post(':id/validate')
  @UseGuards(JwtAuthGuard)
  @RequirePermission('commerce.manage')
  validate(@Param('id') id: string) {
    return this.cartsService.validate(id);
  }

  @Post(':id/checkout')
  @UseGuards(JwtAuthGuard)
  @RequirePermission('commerce.manage')
  checkout(@Param('id') id: string, @Body() dto: CheckoutDto) {
    return this.cartsService.checkout(id, dto);
  }
}
