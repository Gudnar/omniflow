import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, Request, HttpCode } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards';
import { RequirePermission } from '../auth/decorators';
import { ProductsService } from './products.service';
import { CreateProductDto, UpdateProductDto } from './dto/product.dto';

@Controller('products')
export class ProductsController {
  constructor(private productsService: ProductsService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  @RequirePermission('products.read')
  @HttpCode(200)
  list() {
    return this.productsService.list();
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @RequirePermission('products.read')
  @HttpCode(200)
  findOne(@Param('id') id: string) {
    return this.productsService.findOne(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @RequirePermission('products.manage')
  create(@Body() dto: CreateProductDto) {
    return this.productsService.create(dto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @RequirePermission('products.manage')
  update(@Param('id') id: string, @Body() dto: UpdateProductDto) {
    return this.productsService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @RequirePermission('products.manage')
  @HttpCode(200)
  remove(@Param('id') id: string) {
    return this.productsService.remove(id);
  }

  @Get(':id/branch-products')
  @UseGuards(JwtAuthGuard)
  @RequirePermission('products.read')
  @HttpCode(200)
  getBranchProducts(@Request() req: any, @Param('id') id: string) {
    return this.productsService.getBranchProducts(req.user.tenantId, id);
  }
}
