import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, HttpCode } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards';
import { RequirePermission } from '../auth/decorators';
import { CategoriesService } from './categories.service';
import { CreateCategoryDto, UpdateCategoryDto } from './dto/category.dto';

@Controller('categories')
export class CategoriesController {
  constructor(private categoriesService: CategoriesService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  @RequirePermission('products.read')
  @HttpCode(200)
  list() {
    return this.categoriesService.list();
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @RequirePermission('products.manage')
  create(@Body() dto: CreateCategoryDto) {
    return this.categoriesService.create(dto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @RequirePermission('products.manage')
  update(@Param('id') id: string, @Body() dto: UpdateCategoryDto) {
    return this.categoriesService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @RequirePermission('products.manage')
  @HttpCode(200)
  remove(@Param('id') id: string) {
    return this.categoriesService.remove(id);
  }
}
