import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundError } from '@omniflow/utils';
import { CreateBranchDto, UpdateBranchDto } from './branches.dto';

@Injectable()
export class BranchesService {
  constructor(private prisma: PrismaService) {}

  async list(tenantId: string) {
    return this.prisma.client.branch.findMany({
      where: { tenantId },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string) {
    const branch = await this.prisma.client.branch.findUnique({ where: { id } });
    if (!branch) throw new NotFoundError('Branch');
    return branch;
  }

  async create(dto: CreateBranchDto) {
    let slug = this.generateSlug(dto.name);
    let retries = 0;
    const maxRetries = 5;

    while (retries < maxRetries) {
      try {
        return await this.prisma.client.branch.create({
          data: {
            name: dto.name,
            slug,
            address: dto.address,
            latitude: dto.latitude,
            longitude: dto.longitude,
            timezone: dto.timezone,
          },
        });
      } catch (error: any) {
        if (error.code === 'P2002' && error.meta?.target?.includes('slug')) {
          retries++;
          if (retries >= maxRetries) {
            throw error;
          }
          const suffix = Math.random().toString(36).substring(7).slice(0, 3);
          slug = `${this.generateSlug(dto.name)}-${suffix}`;
        } else {
          throw error;
        }
      }
    }

    throw new Error('Unable to create branch: slug collision');
  }

  async update(id: string, dto: UpdateBranchDto) {
    await this.findOne(id);
    return this.prisma.client.branch.update({ where: { id }, data: dto });
  }

  async deactivate(id: string) {
    await this.findOne(id);
    return this.prisma.client.branch.update({
      where: { id },
      data: { status: 'INACTIVE' },
    });
  }

  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 50);
  }
}
