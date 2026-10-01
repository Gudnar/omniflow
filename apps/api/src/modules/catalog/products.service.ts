import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConflictError, NotFoundError } from '@omniflow/utils';
import { CreateProductDto, UpdateProductDto } from './dto/product.dto';

const PRODUCT_LIST_INCLUDE = {
  category: { select: { id: true, name: true } },
  variants: { select: { id: true } },
  media: { where: { isPrimary: true }, take: 1 },
};

const PRODUCT_DETAIL_INCLUDE = {
  category: { select: { id: true, name: true } },
  variants: { orderBy: { sortOrder: 'asc' as const } },
  media: { orderBy: { sortOrder: 'asc' as const } },
};

@Injectable()
export class ProductsService {
  constructor(private prisma: PrismaService) {}

  async list() {
    return this.prisma.client.product.findMany({
      include: PRODUCT_LIST_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const product = await this.prisma.client.product.findUnique({
      where: { id },
      include: PRODUCT_DETAIL_INCLUDE,
    });
    if (!product) throw new NotFoundError('Product');
    return product;
  }

  async create(dto: CreateProductDto) {
    const { variants, ...productData } = dto;

    try {
      return await this.prisma.client.$transaction(async (tx: any) => {
        const product = await tx.product.create({ data: productData });

        const variantsToCreate = variants?.length
          ? variants
          : [{ sku: dto.slug, name: undefined, attributes: {}, sortOrder: 0 }];

        await tx.productVariant.createMany({
          data: variantsToCreate.map((v, i) => ({
            productId: product.id,
            name: v.name,
            sku: v.sku,
            attributes: v.attributes ?? {},
            sortOrder: v.sortOrder ?? i,
          })),
        });

        return tx.product.findUnique({ where: { id: product.id }, include: PRODUCT_DETAIL_INCLUDE });
      });
    } catch (error: any) {
      if (error.code === 'P2002') {
        const field = error.meta?.target?.includes('sku') ? 'sku' : 'slug';
        throw new ConflictError(`A product/variant with this ${field} already exists`, { field });
      }
      throw error;
    }
  }

  async update(id: string, dto: UpdateProductDto) {
    await this.findOne(id);
    try {
      return await this.prisma.client.product.update({
        where: { id },
        data: dto,
        include: PRODUCT_DETAIL_INCLUDE,
      });
    } catch (error: any) {
      if (error.code === 'P2002') {
        throw new ConflictError('A product with this slug already exists', { field: 'slug' });
      }
      throw error;
    }
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.client.product.delete({ where: { id } });
    return { success: true };
  }

  // Lazily provisions a BranchProduct row (price 0, stock 0, UNAVAILABLE) for
  // every (tenant branch x product variant) combination missing one, then
  // returns the full grid — same lazy-init precedent as
  // EcommerceStoreService.getOrCreate.
  async getBranchProducts(tenantId: string, productId: string) {
    const product = await this.findOne(productId);

    const [branches, existing] = await Promise.all([
      this.prisma.client.branch.findMany({ where: {}, select: { id: true } }),
      this.prisma.client.branchProduct.findMany({ where: { productId } }),
    ]);

    const existingKeys = new Set(existing.map((bp: any) => `${bp.branchId}:${bp.variantId}`));
    const missing: { tenantId: string; branchId: string; productId: string; variantId: string; price: number }[] = [];

    for (const branch of branches) {
      for (const variant of product.variants) {
        const key = `${branch.id}:${variant.id}`;
        if (!existingKeys.has(key)) {
          missing.push({ tenantId, branchId: branch.id, productId, variantId: variant.id, price: 0 });
        }
      }
    }

    if (missing.length) {
      await this.prisma.client.branchProduct.createMany({ data: missing });
    }

    const rows = await this.prisma.client.branchProduct.findMany({
      where: { productId },
      include: { branch: { select: { id: true, name: true } }, variant: { select: { id: true, name: true, sku: true } } },
      orderBy: [{ branchId: 'asc' }, { variantId: 'asc' }],
    });

    return rows.map(serializeBranchProduct);
  }
}

export function serializeBranchProduct(row: any) {
  return {
    ...row,
    price: Number(row.price),
    compareAtPrice: row.compareAtPrice === null ? null : Number(row.compareAtPrice),
  };
}
