import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundError, ValidationError } from '@omniflow/utils';
import { CreateVehicleDto, UpdateVehicleDto } from './vehicle.dto';

@Injectable()
export class VehiclesService {
  constructor(private prisma: PrismaService) {}

  async list(branchId?: string) {
    return this.prisma.client.vehicle.findMany({
      where: branchId ? { OR: [{ branchId }, { branchId: null }] } : {},
      orderBy: { createdAt: 'asc' },
    });
  }

  private async assertBranchBelongsToTenant(branchId: string) {
    const branch = await this.prisma.client.branch.findUnique({ where: { id: branchId } });
    if (!branch) throw new ValidationError('branchId no corresponde a una sucursal de este negocio');
  }

  async create(tenantId: string, dto: CreateVehicleDto) {
    if (dto.branchId) await this.assertBranchBelongsToTenant(dto.branchId);
    return this.prisma.client.vehicle.create({
      data: {
        tenantId,
        type: dto.type,
        branchId: dto.branchId,
        label: dto.label,
        plate: dto.plate,
        notes: dto.notes,
      },
    });
  }

  async update(id: string, dto: UpdateVehicleDto) {
    const existing = await this.prisma.client.vehicle.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError('Vehicle');
    if (dto.branchId) await this.assertBranchBelongsToTenant(dto.branchId);

    return this.prisma.client.vehicle.update({
      where: { id },
      data: {
        ...(dto.type !== undefined && { type: dto.type }),
        ...(dto.branchId !== undefined && { branchId: dto.branchId }),
        ...(dto.label !== undefined && { label: dto.label }),
        ...(dto.plate !== undefined && { plate: dto.plate }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
      },
    });
  }

  async delete(id: string) {
    const existing = await this.prisma.client.vehicle.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError('Vehicle');
    await this.prisma.client.vehicle.delete({ where: { id } });
    return { success: true };
  }
}
