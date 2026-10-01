import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundError } from '@omniflow/utils';
import { ProductsService } from './products.service';
import { CreateProductMediaDto, UpdateProductMediaDto } from './dto/product-media.dto';

@Injectable()
export class ProductMediaService {
  constructor(
    private prisma: PrismaService,
    private productsService: ProductsService,
  ) {}

  async create(productId: string, dto: CreateProductMediaDto) {
    await this.productsService.findOne(productId);

    if (dto.isPrimary) {
      await this.prisma.client.productMedia.updateMany({ where: { productId }, data: { isPrimary: false } });
    }

    return this.prisma.client.productMedia.create({
      data: {
        productId,
        url: dto.url,
        altText: dto.altText,
        sortOrder: dto.sortOrder ?? 0,
        isPrimary: dto.isPrimary ?? false,
      },
    });
  }

  async update(productId: string, mediaId: string, dto: UpdateProductMediaDto) {
    const media = await this.prisma.client.productMedia.findFirst({ where: { id: mediaId, productId } });
    if (!media) throw new NotFoundError('ProductMedia');

    if (dto.isPrimary) {
      await this.prisma.client.productMedia.updateMany({ where: { productId }, data: { isPrimary: false } });
    }

    return this.prisma.client.productMedia.update({ where: { id: mediaId }, data: dto });
  }

  async remove(productId: string, mediaId: string) {
    const media = await this.prisma.client.productMedia.findFirst({ where: { id: mediaId, productId } });
    if (!media) throw new NotFoundError('ProductMedia');
    await this.prisma.client.productMedia.delete({ where: { id: mediaId } });
    return { success: true };
  }
}
