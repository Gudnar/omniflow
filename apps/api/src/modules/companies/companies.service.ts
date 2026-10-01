import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundError } from '@omniflow/utils';
import { CreateCompanyDto, UpdateCompanyDto } from './companies.dto';

@Injectable()
export class CompaniesService {
  constructor(private prisma: PrismaService) {}

  async list(tenantId: string) {
    return this.prisma.client.company.findMany({
      where: { tenantId },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string) {
    const company = await this.prisma.client.company.findUnique({ where: { id } });
    if (!company) throw new NotFoundError('Company');
    return company;
  }

  async create(dto: CreateCompanyDto) {
    return this.prisma.client.company.create({ data: dto });
  }

  async update(id: string, dto: UpdateCompanyDto) {
    await this.findOne(id);
    return this.prisma.client.company.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.client.company.delete({ where: { id } });
    return { success: true };
  }
}
