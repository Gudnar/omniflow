import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { CategoriesController } from './categories.controller';
import { CategoriesService } from './categories.service';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';
import { ProductsImportExportService } from './products-import-export.service';
import { VariantsController } from './variants.controller';
import { VariantsService } from './variants.service';
import { ProductMediaController } from './product-media.controller';
import { ProductMediaService } from './product-media.service';
import { BranchProductsController } from './branch-products.controller';
import { BranchProductsService } from './branch-products.service';
import { InventoryTransfersController } from './inventory-transfers.controller';
import { InventoryTransfersService } from './inventory-transfers.service';

@Module({
  imports: [PrismaModule],
  controllers: [
    CategoriesController,
    ProductsController,
    VariantsController,
    ProductMediaController,
    BranchProductsController,
    InventoryTransfersController,
  ],
  providers: [
    CategoriesService,
    ProductsService,
    ProductsImportExportService,
    VariantsService,
    ProductMediaService,
    BranchProductsService,
    InventoryTransfersService,
  ],
})
export class CatalogModule {}
