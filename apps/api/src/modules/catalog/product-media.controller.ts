import { Controller, Post, Patch, Delete, Body, Param, UseGuards, HttpCode } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards';
import { RequirePermission } from '../auth/decorators';
import { ProductMediaService } from './product-media.service';
import { CreateProductMediaDto, UpdateProductMediaDto } from './dto/product-media.dto';

@Controller('products/:productId/media')
export class ProductMediaController {
  constructor(private productMediaService: ProductMediaService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @RequirePermission('products.manage')
  create(@Param('productId') productId: string, @Body() dto: CreateProductMediaDto) {
    return this.productMediaService.create(productId, dto);
  }

  @Patch(':mediaId')
  @UseGuards(JwtAuthGuard)
  @RequirePermission('products.manage')
  update(
    @Param('productId') productId: string,
    @Param('mediaId') mediaId: string,
    @Body() dto: UpdateProductMediaDto,
  ) {
    return this.productMediaService.update(productId, mediaId, dto);
  }

  @Delete(':mediaId')
  @UseGuards(JwtAuthGuard)
  @RequirePermission('products.manage')
  @HttpCode(200)
  remove(@Param('productId') productId: string, @Param('mediaId') mediaId: string) {
    return this.productMediaService.remove(productId, mediaId);
  }
}
