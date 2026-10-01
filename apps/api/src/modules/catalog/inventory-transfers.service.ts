import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundError, ValidationError } from '@omniflow/utils';
import { CreateTransferDto } from './dto/inventory-transfer.dto';

const TRANSFER_INCLUDE = {
  fromBranch: { select: { id: true, name: true } },
  toBranch: { select: { id: true, name: true } },
  items: { include: { variant: { select: { id: true, name: true, sku: true } } } },
};

@Injectable()
export class InventoryTransfersService {
  constructor(private prisma: PrismaService) {}

  async list() {
    return this.prisma.client.inventoryTransfer.findMany({
      include: TRANSFER_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const transfer = await this.prisma.client.inventoryTransfer.findUnique({
      where: { id },
      include: TRANSFER_INCLUDE,
    });
    if (!transfer) throw new NotFoundError('InventoryTransfer');
    return transfer;
  }

  async create(tenantId: string, actorUserId: string, dto: CreateTransferDto) {
    if (dto.fromBranchId === dto.toBranchId) {
      throw new ValidationError('fromBranchId and toBranchId must be different branches');
    }

    const branches = await this.prisma.client.branch.findMany({
      where: { id: { in: [dto.fromBranchId, dto.toBranchId] } },
      select: { id: true },
    });
    if (branches.length !== 2) {
      throw new ValidationError('fromBranchId and toBranchId must both belong to this tenant');
    }

    return this.prisma.client.$transaction(async (tx: any) => {
      const transfer = await tx.inventoryTransfer.create({
        data: {
          fromBranchId: dto.fromBranchId,
          toBranchId: dto.toBranchId,
          note: dto.note,
          createdByUserId: actorUserId,
        },
      });

      await tx.inventoryTransferItem.createMany({
        data: dto.items.map((item) => ({
          transferId: transfer.id,
          variantId: item.variantId,
          quantity: item.quantity,
        })),
      });

      return tx.inventoryTransfer.findUnique({ where: { id: transfer.id }, include: TRANSFER_INCLUDE });
    });
  }

  async complete(tenantId: string, id: string) {
    const transfer = await this.findOne(id);
    if (transfer.status !== 'PENDING') {
      throw new ValidationError('Only a PENDING transfer can be completed');
    }

    return this.prisma.client.$transaction(async (tx: any) => {
      for (const item of transfer.items) {
        const sourceBranchProduct = await tx.branchProduct.findUnique({
          where: { branchId_variantId: { branchId: transfer.fromBranchId, variantId: item.variantId } },
        });
        if (!sourceBranchProduct || sourceBranchProduct.stock < item.quantity) {
          throw new ValidationError(
            `Insufficient stock at the source branch for variant ${item.variantId}`,
          );
        }

        await tx.branchProduct.update({
          where: { id: sourceBranchProduct.id },
          data: { stock: sourceBranchProduct.stock - item.quantity },
        });
        await tx.inventoryMovement.create({
          data: {
            branchProductId: sourceBranchProduct.id,
            type: 'TRANSFER_OUT',
            quantityChange: -item.quantity,
            note: `Transfer ${transfer.id} to branch ${transfer.toBranchId}`,
          },
        });

        let destBranchProduct = await tx.branchProduct.findUnique({
          where: { branchId_variantId: { branchId: transfer.toBranchId, variantId: item.variantId } },
        });
        if (!destBranchProduct) {
          destBranchProduct = await tx.branchProduct.create({
            data: {
              tenantId,
              branchId: transfer.toBranchId,
              productId: sourceBranchProduct.productId,
              variantId: item.variantId,
              price: sourceBranchProduct.price,
              stock: 0,
            },
          });
        }

        await tx.branchProduct.update({
          where: { id: destBranchProduct.id },
          data: { stock: destBranchProduct.stock + item.quantity },
        });
        await tx.inventoryMovement.create({
          data: {
            branchProductId: destBranchProduct.id,
            type: 'TRANSFER_IN',
            quantityChange: item.quantity,
            note: `Transfer ${transfer.id} from branch ${transfer.fromBranchId}`,
          },
        });
      }

      return tx.inventoryTransfer.update({
        where: { id },
        data: { status: 'COMPLETED', completedAt: new Date() },
        include: TRANSFER_INCLUDE,
      });
    });
  }

  async cancel(id: string) {
    const transfer = await this.findOne(id);
    if (transfer.status !== 'PENDING') {
      throw new ValidationError('Only a PENDING transfer can be cancelled');
    }
    return this.prisma.client.inventoryTransfer.update({
      where: { id },
      data: { status: 'CANCELLED' },
      include: TRANSFER_INCLUDE,
    });
  }
}
