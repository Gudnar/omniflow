import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { prisma, createTenantScopedExtension } from '@omniflow/database';
import { TenantContextService } from '../tenant-context/tenant-context.service';

@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  client: any;
  /**
   * Unscoped client. Only for pre-authentication lookups (login/register by
   * email, refresh by token hash) where the tenant is not yet known.
   */
  raw = prisma;

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
