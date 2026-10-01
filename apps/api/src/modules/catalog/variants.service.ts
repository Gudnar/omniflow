import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConflictError, NotFoundError, ValidationError } from '@omniflow/utils';
import { ProductsService } from './products.service';
import { CreateVariantDto, UpdateVariantDto } from './dto/variant.dto';

@Injectable()
export class VariantsService {
  constructor(
    private prisma: PrismaService,
    private productsService: ProductsService,
  ) {}

  async create(productId: string, dto: CreateVariantDto) {
    await this.productsService.findOne(productId);
    try {
      return await this.prisma.client.productVariant.create({
        data: {
          productId,
          name: dto.name,
          sku: dto.sku,
          attributes: dto.attributes ?? {},
          sortOrder: dto.sortOrder ?? 0,
        },
      });
    } catch (error: any) {
      if (error.code === 'P2002') {
        throw new ConflictError('A variant with this SKU already exists', { field: 'sku' });
      }
      throw error;
    }
  }

  async update(productId: string, variantId: string, dto: UpdateVariantDto) {
    const variant = await this.prisma.client.productVariant.findFirst({ where: { id: variantId, productId } });
    if (!variant) throw new NotFoundError('ProductVariant');

    try {
      return await this.prisma.client.productVariant.update({ where: { id: variantId }, data: dto });
    } catch (error: any) {
      if (error.code === 'P2002') {
        throw new ConflictError('A variant with this SKU already exists', { field: 'sku' });
      }
      throw error;
    }
  }

  async remove(productId: string, variantId: string) {
    const variant = await this.prisma.client.productVariant.findFirst({ where: { id: variantId, productId } });
    if (!variant) throw new NotFoundError('ProductVariant');

    const siblingCount = await this.prisma.client.productVariant.count({ where: { productId } });
    if (siblingCount <= 1) {
      throw new ValidationError('A product must always have at least one variant');
    }

    await this.prisma.client.productVariant.delete({ where: { id: variantId } });
    return { success: true };
  }
}
