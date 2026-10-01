import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundError } from '@omniflow/utils';
import { UpdateTenantDto } from './dto/update-tenant.dto';

const TENANT_SELECT = {
  id: true,
  name: true,
  slug: true,
  status: true,
  taxId: true,
  description: true,
  logo: true,
  timezone: true,
  language: true,
  currency: true,
  dateFormat: true,
  timeFormat: true,
  decimalSeparator: true,
  thousandsSeparator: true,
  orderApprovalMode: true,
  appointmentApprovalMode: true,
  notifyOnOrderPendingApproval: true,
  notifyOnAppointmentPendingApproval: true,
  createdAt: true,
  updatedAt: true,
};

@Injectable()
export class TenantsService {
  constructor(private prisma: PrismaService) {}

  async get(tenantId: string) {
    const tenant = await this.prisma.client.tenant.findUnique({ where: { id: tenantId }, select: TENANT_SELECT });
    if (!tenant) throw new NotFoundError('Tenant');
    return tenant;
  }

  async update(tenantId: string, dto: UpdateTenantDto) {
    await this.get(tenantId);
    return this.prisma.client.tenant.update({ where: { id: tenantId }, data: dto, select: TENANT_SELECT });
  }
}
