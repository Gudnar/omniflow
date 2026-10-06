import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, UseInterceptors, UploadedFile, Request, Response, HttpCode } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response as ExpressResponse } from 'express';
import { ValidationError } from '@omniflow/utils';
import { JwtAuthGuard } from '../auth/guards';
import { RequirePermission } from '../auth/decorators';
import { ProductsService } from './products.service';
import { ProductsImportExportService } from './products-import-export.service';
import { CreateProductDto, UpdateProductDto } from './dto/product.dto';

const MAX_IMPORT_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
const XLSX_MIME_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

@Controller('products')
export class ProductsController {
  constructor(
    private productsService: ProductsService,
    private importExportService: ProductsImportExportService,
  ) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  @RequirePermission('products.read')
  @HttpCode(200)
  list() {
    return this.productsService.list();
  }

  // Routes with a literal segment ("export") must be declared before
  // GET /products/:id — otherwise Nest's order-matched routing treats
  // "export" as the :id param and this handler is never reached.
  @Get('export')
  @UseGuards(JwtAuthGuard)
  @RequirePermission('products.read')
  @HttpCode(200)
  async exportProducts(@Response() res: ExpressResponse) {
    const buffer = await this.importExportService.exportProducts();
    res.setHeader('Content-Type', XLSX_MIME_TYPE);
    res.setHeader('Content-Disposition', 'attachment; filename="productos.xlsx"');
    res.send(buffer);
  }

  @Post('import')
  @UseGuards(JwtAuthGuard)
  @RequirePermission('products.manage')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_IMPORT_SIZE_BYTES },
      fileFilter: (_req, file, cb) => {
        if (file.mimetype !== XLSX_MIME_TYPE) {
          return cb(new ValidationError('Unsupported file type. Use .xlsx (Excel).'), false);
        }
        cb(null, true);
      },
    }),
  )
  @HttpCode(200)
  importProducts(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new ValidationError('A .xlsx file is required');
    return this.importExportService.importProducts(file.buffer);
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
