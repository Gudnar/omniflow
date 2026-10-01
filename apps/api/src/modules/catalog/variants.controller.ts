import { Controller, Post, Patch, Delete, Body, Param, UseGuards, HttpCode } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards';
import { RequirePermission } from '../auth/decorators';
import { VariantsService } from './variants.service';
import { CreateVariantDto, UpdateVariantDto } from './dto/variant.dto';

@Controller('products/:productId/variants')
export class VariantsController {
  constructor(private variantsService: VariantsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @RequirePermission('products.manage')
  create(@Param('productId') productId: string, @Body() dto: CreateVariantDto) {
    return this.variantsService.create(productId, dto);
  }

  @Patch(':variantId')
  @UseGuards(JwtAuthGuard)
  @RequirePermission('products.manage')
  update(
    @Param('productId') productId: string,
    @Param('variantId') variantId: string,
    @Body() dto: UpdateVariantDto,
  ) {
    return this.variantsService.update(productId, variantId, dto);
  }

  @Delete(':variantId')
  @UseGuards(JwtAuthGuard)
  @RequirePermission('products.manage')
  @HttpCode(200)
  remove(@Param('productId') productId: string, @Param('variantId') variantId: string) {
    return this.variantsService.remove(productId, variantId);
  }
}
