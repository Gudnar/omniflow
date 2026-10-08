import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundError, ValidationError } from '@omniflow/utils';
import { CreateRoleDto, UpdateRoleDto } from './roles.dto';

const ROLE_INCLUDE = { permissions: { include: { permission: true } } };

@Injectable()
export class RolesService {
  constructor(private prisma: PrismaService) {}

  async list() {
    return this.prisma.client.role.findMany({
      include: ROLE_INCLUDE,
      orderBy: { createdAt: 'asc' },
    });
  }

  // Exposed so the frontend can render the permission checklist — same
  // shape/purpose as GET /ai/tools for the AI agent's tool checklist.
  async getPermissionsCatalog() {
    return this.prisma.client.permission.findMany({ orderBy: { code: 'asc' } });
  }

  async create(tenantId: string, dto: CreateRoleDto) {
    const permissions = await this.prisma.client.permission.findMany({
      where: { code: { in: dto.permissionCodes } },
    });
    if (permissions.length !== dto.permissionCodes.length) {
      throw new ValidationError('One or more permission codes do not exist');
    }

    return this.prisma.client.role.create({
      data: {
        tenantId,
        name: dto.name,
        isSystem: false,
        permissions: {
          create: permissions.map((p: any) => ({ permissionId: p.id, scope: 'TENANT' })),
        },
      },
      include: ROLE_INCLUDE,
    });
  }

  private async findEditable(id: string) {
    const role = await this.prisma.client.role.findUnique({ where: { id } });
    if (!role) throw new NotFoundError('Role');
    if (role.isSystem) throw new ValidationError('System roles cannot be edited or deleted');
    return role;
  }

  async update(id: string, dto: UpdateRoleDto) {
    await this.findEditable(id);

    if (dto.permissionCodes) {
      const permissions = await this.prisma.client.permission.findMany({
        where: { code: { in: dto.permissionCodes } },
      });
      if (permissions.length !== dto.permissionCodes.length) {
        throw new ValidationError('One or more permission codes do not exist');
      }

      await this.prisma.client.$transaction([
        this.prisma.client.rolePermission.deleteMany({ where: { roleId: id } }),
        this.prisma.client.rolePermission.createMany({
          data: permissions.map((p: any) => ({ roleId: id, permissionId: p.id, scope: 'TENANT' })),
        }),
      ]);
    }

    return this.prisma.client.role.update({
      where: { id },
      data: { ...(dto.name && { name: dto.name }) },
      include: ROLE_INCLUDE,
    });
  }

  async delete(id: string) {
    await this.findEditable(id);

    const assignedUserCount = await this.prisma.client.userRole.count({ where: { roleId: id } });
    if (assignedUserCount > 0) {
      throw new ValidationError('Cannot delete a role that is still assigned to users');
    }

    await this.prisma.client.role.delete({ where: { id } });
    return { success: true };
  }

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
