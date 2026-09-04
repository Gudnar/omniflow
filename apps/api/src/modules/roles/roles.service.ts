import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class RolesService {
  constructor(private prisma: PrismaService) {}

  async seedDefaultRolesForTenant(tenantId: string, tx?: any) {
    const prismaClient = tx || this.prisma.client;

    const permissions = await prismaClient.permission.findMany();
    if (permissions.length === 0) {
      throw new Error('Global permissions not seeded. Run pnpm db:seed first.');
    }

    const allPermissionCodes = permissions.map((p: any) => p.code);
    const readOnlyPermissionCodes = allPermissionCodes.filter((code: string) =>
      code.endsWith('.read'),
    );
    const adminPermissionCodes = allPermissionCodes.filter(
      (code: string) => !code.startsWith('tenant.') && !code.startsWith('roles.'),
    );

    // OWNER: all permissions with TENANT scope
    const ownerRole = await prismaClient.role.upsert({
      where: { tenantId_name: { tenantId, name: 'OWNER' } },
      update: {},
      create: {
        tenantId,
        name: 'OWNER',
        isSystem: true,
      },
    });

    for (const permissionCode of allPermissionCodes) {
      const permission = await prismaClient.permission.findUnique({
        where: { code: permissionCode },
      });

      if (permission) {
        await prismaClient.rolePermission.upsert({
          where: {
            roleId_permissionId: {
              roleId: ownerRole.id,
              permissionId: permission.id,
            },
          },
          update: {},
          create: {
            roleId: ownerRole.id,
            permissionId: permission.id,
            scope: 'TENANT',
          },
        });
      }
    }

    // ADMIN: all permissions except tenant.manage and roles.manage, with TENANT scope
    const adminRole = await prismaClient.role.upsert({
      where: { tenantId_name: { tenantId, name: 'ADMIN' } },
      update: {},
      create: {
        tenantId,
        name: 'ADMIN',
        isSystem: false,
      },
    });

    for (const permissionCode of adminPermissionCodes) {
      const permission = await prismaClient.permission.findUnique({
        where: { code: permissionCode },
      });

      if (permission) {
        await prismaClient.rolePermission.upsert({
          where: {
            roleId_permissionId: {
              roleId: adminRole.id,
              permissionId: permission.id,
            },
          },
          update: {},
          create: {
            roleId: adminRole.id,
            permissionId: permission.id,
            scope: 'TENANT',
          },
        });
      }
    }

    // MEMBER: read-only permissions, will be upgraded to BRANCH scope in Fase 3
    const memberRole = await prismaClient.role.upsert({
      where: { tenantId_name: { tenantId, name: 'MEMBER' } },
      update: {},
      create: {
        tenantId,
        name: 'MEMBER',
        isSystem: false,
      },
    });

    for (const permissionCode of readOnlyPermissionCodes) {
      const permission = await prismaClient.permission.findUnique({
        where: { code: permissionCode },
      });

      if (permission) {
        await prismaClient.rolePermission.upsert({
          where: {
            roleId_permissionId: {
              roleId: memberRole.id,
              permissionId: permission.id,
            },
          },
          update: {},
          create: {
            roleId: memberRole.id,
            permissionId: permission.id,
            scope: 'BRANCH',
          },
        });
      }
    }

    return { ownerRole, adminRole, memberRole };
  }
}
