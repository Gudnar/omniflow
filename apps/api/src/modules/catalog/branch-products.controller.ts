import { Controller, Get, Patch, Post, Body, Param, UseGuards, Request, HttpCode } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards';
import { RequirePermission } from '../auth/decorators';
import { BranchProductsService } from './branch-products.service';
import { UpdateBranchProductDto, AdjustStockDto } from './dto/branch-product.dto';

@Controller('branch-products')
export class BranchProductsController {
  constructor(private branchProductsService: BranchProductsService) {}

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @RequirePermission('products.manage')
  @HttpCode(200)
  update(@Param('id') id: string, @Body() dto: UpdateBranchProductDto) {
    return this.branchProductsService.update(id, dto);
  }

  @Post(':id/adjust-stock')
  @UseGuards(JwtAuthGuard)
  @RequirePermission('products.manage')
  adjustStock(@Request() req: any, @Param('id') id: string, @Body() dto: AdjustStockDto) {
    return this.branchProductsService.adjustStock(id, req.user.userId, dto);
  }

  @Get(':id/movements')
  @UseGuards(JwtAuthGuard)
  @RequirePermission('products.read')
  @HttpCode(200)
  listMovements(@Param('id') id: string) {
    return this.branchProductsService.listMovements(id);
  }
}
