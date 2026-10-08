import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundError, ValidationError } from '@omniflow/utils';
import { CreateDriverDto, UpdateDriverDto } from './driver.dto';

@Injectable()
export class DriversService {
  constructor(private prisma: PrismaService) {}

  async list(branchId?: string) {
    return this.prisma.client.driver.findMany({
      // null branchId = available to any branch, so it's included
      // regardless of which branch is being filtered on.
      where: branchId ? { OR: [{ branchId }, { branchId: null }] } : {},
      orderBy: { name: 'asc' },
    });
  }

  private async assertBranchBelongsToTenant(branchId: string) {
    const branch = await this.prisma.client.branch.findUnique({ where: { id: branchId } });
    if (!branch) throw new ValidationError('branchId no corresponde a una sucursal de este negocio');
  }

  async create(tenantId: string, dto: CreateDriverDto) {
    if (dto.branchId) await this.assertBranchBelongsToTenant(dto.branchId);
    return this.prisma.client.driver.create({
      data: { tenantId, name: dto.name, phone: dto.phone, branchId: dto.branchId, notes: dto.notes },
    });
  }

  async update(id: string, dto: UpdateDriverDto) {
    const existing = await this.prisma.client.driver.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError('Driver');
    if (dto.branchId) await this.assertBranchBelongsToTenant(dto.branchId);

    return this.prisma.client.driver.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.phone !== undefined && { phone: dto.phone }),
        ...(dto.branchId !== undefined && { branchId: dto.branchId }),
        ...(dto.status !== undefined && { status: dto.status }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
      },
    });
  }

  async delete(id: string) {
    const existing = await this.prisma.client.driver.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError('Driver');

    const assignmentCount = await this.prisma.client.deliveryAssignment.count({ where: { driverId: id } });
    if (assignmentCount > 0) {
      throw new ValidationError(
        'Este conductor ya tiene rutas asignadas en su historial; desactivalo en vez de eliminarlo.',
      );
    }
    await this.prisma.client.driver.delete({ where: { id } });
    return { success: true };
  }
}
