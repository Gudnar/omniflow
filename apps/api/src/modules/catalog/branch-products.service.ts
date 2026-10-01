import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundError, ValidationError } from '@omniflow/utils';
import { UpdateBranchProductDto, AdjustStockDto } from './dto/branch-product.dto';
import { serializeBranchProduct } from './products.service';

@Injectable()
export class BranchProductsService {
  constructor(private prisma: PrismaService) {}

  async findOne(id: string) {
    const row = await this.prisma.client.branchProduct.findUnique({
      where: { id },
      include: { branch: { select: { id: true, name: true } }, variant: { select: { id: true, name: true, sku: true } } },
    });
    if (!row) throw new NotFoundError('BranchProduct');
    return row;
  }

  async update(id: string, dto: UpdateBranchProductDto) {
    await this.findOne(id);
    const updated = await this.prisma.client.branchProduct.update({
      where: { id },
      data: dto,
      include: { branch: { select: { id: true, name: true } }, variant: { select: { id: true, name: true, sku: true } } },
    });
    return serializeBranchProduct(updated);
  }

  async adjustStock(id: string, actorUserId: string, dto: AdjustStockDto) {
    const branchProduct = await this.findOne(id);
    const resultingStock = branchProduct.stock + dto.quantityChange;
    if (resultingStock < 0) {
      throw new ValidationError('Stock adjustment would result in negative stock');
    }

    const updated = await this.prisma.client.$transaction(async (tx: any) => {
      await tx.inventoryMovement.create({
        data: {
          branchProductId: id,
          type: dto.type,
          quantityChange: dto.quantityChange,
          note: dto.note,
          createdByUserId: actorUserId,
        },
      });

      return tx.branchProduct.update({
        where: { id },
        data: { stock: resultingStock },
        include: { branch: { select: { id: true, name: true } }, variant: { select: { id: true, name: true, sku: true } } },
      });
    });

    return serializeBranchProduct(updated);
  }

  async listMovements(id: string) {
    await this.findOne(id);
    return this.prisma.client.inventoryMovement.findMany({
      where: { branchProductId: id },
      orderBy: { createdAt: 'desc' },
    });
  }
}
