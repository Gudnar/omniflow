import { Injectable } from '@nestjs/common';
import { hash } from 'argon2';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundError, ConflictError, ValidationError } from '@omniflow/utils';
import { CreateUserDto, UpdateUserDto } from './users.dto';

const USER_SELECT = {
  id: true,
  email: true,
  status: true,
  mfaEnabled: true,
  createdAt: true,
  updatedAt: true,
  roles: { select: { role: { select: { id: true, name: true } } } },
  branches: { select: { branch: { select: { id: true, name: true } } } },
};

// Flattens the join-table shape Prisma returns (roles: [{role: {...}}]) into
// roles: [{...}] directly — the frontend never needs the join row itself.
function serializeUser(user: any) {
  return {
    ...user,
    roles: user.roles.map((ur: any) => ur.role),
    branches: user.branches.map((ub: any) => ub.branch),
  };
}

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async getUserById(userId: string) {
    const user = await this.prisma.client.user.findUnique({ where: { id: userId }, select: USER_SELECT });
    if (!user) throw new NotFoundError('User');
    return serializeUser(user);
  }

  async listUsersByTenant(tenantId: string) {
    const users = await this.prisma.client.user.findMany({ where: { tenantId }, select: USER_SELECT });
    return users.map(serializeUser);
  }

  // Password set directly by the inviting admin (@RequirePermission('users.manage'))
  // — there is no email-invite flow yet, so the new collaborator needs their
  // credential handed to them out of band (WhatsApp, in person, etc.).
  async create(tenantId: string, dto: CreateUserDto) {
    const existing = await this.prisma.raw.user.findUnique({ where: { email: dto.email } });
    if (existing) throw new ConflictError('Email already registered', { field: 'email' });

    await this.validateRolesAndBranches(tenantId, dto.roleIds, dto.branchIds);

    const passwordHash = await hash(dto.password);
    const user = await this.prisma.client.$transaction(async (tx: any) => {
      const created = await tx.user.create({
        data: { tenantId, email: dto.email, passwordHash, status: 'ACTIVE' },
      });
      if (dto.roleIds.length) {
        await tx.userRole.createMany({ data: dto.roleIds.map((roleId) => ({ userId: created.id, roleId })) });
      }
      if (dto.branchIds.length) {
        await tx.userBranch.createMany({
          data: dto.branchIds.map((branchId) => ({ userId: created.id, branchId, tenantId })),
        });
      }
      return tx.user.findUnique({ where: { id: created.id }, select: USER_SELECT });
    });

    return serializeUser(user);
  }

  async update(id: string, tenantId: string, dto: UpdateUserDto) {
    const existing = await this.prisma.client.user.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError('User');

    if (dto.roleIds || dto.branchIds) {
      await this.validateRolesAndBranches(tenantId, dto.roleIds ?? [], dto.branchIds ?? [], { skipEmptyCheck: true });
    }

    const user = await this.prisma.client.$transaction(async (tx: any) => {
      if (dto.status) {
        await tx.user.update({ where: { id }, data: { status: dto.status } });
      }
      if (dto.roleIds) {
        await tx.userRole.deleteMany({ where: { userId: id } });
        if (dto.roleIds.length) {
          await tx.userRole.createMany({ data: dto.roleIds.map((roleId: string) => ({ userId: id, roleId })) });
        }
      }
      if (dto.branchIds) {
        await tx.userBranch.deleteMany({ where: { userId: id } });
        if (dto.branchIds.length) {
          await tx.userBranch.createMany({
            data: dto.branchIds.map((branchId: string) => ({ userId: id, branchId, tenantId })),
          });
        }
      }
      return tx.user.findUnique({ where: { id }, select: USER_SELECT });
    });

    return serializeUser(user);
  }

  // Confirms every roleId/branchId the caller sent actually belongs to this
  // tenant — never trusts an id from the client body at face value (same
  // IDOR discipline as the rest of the app).
  private async validateRolesAndBranches(
    tenantId: string,
    roleIds: string[],
    branchIds: string[],
    opts: { skipEmptyCheck?: boolean } = {},
  ) {
    if (roleIds.length) {
      const roleCount = await this.prisma.client.role.count({ where: { id: { in: roleIds }, tenantId } });
      if (roleCount !== roleIds.length) throw new ValidationError('One or more role ids are invalid for this tenant');
    } else if (!opts.skipEmptyCheck) {
      throw new ValidationError('At least one role is required');
    }

    if (branchIds.length) {
      const branchCount = await this.prisma.client.branch.count({ where: { id: { in: branchIds }, tenantId } });
      if (branchCount !== branchIds.length) throw new ValidationError('One or more branch ids are invalid for this tenant');
    }
  }
}
