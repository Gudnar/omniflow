import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { prisma, createTenantScopedExtension } from '@omniflow/database';
import { TenantContextService } from '../tenant-context/tenant-context.service';

@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  client: any;

  constructor(private tenantContext: TenantContextService) {
    this.client = prisma.$extends(
      createTenantScopedExtension(() => this.tenantContext.getTenantId()),
    );
  }

  async onModuleInit() {
    await prisma.$connect();
  }

  async onModuleDestroy() {
    await prisma.$disconnect();
  }
}
