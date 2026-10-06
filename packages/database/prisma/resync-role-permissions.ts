import { PrismaClient } from '../src/prisma';

const prisma = new PrismaClient();

// Backfills newly-added global Permission codes onto every EXISTING
// tenant's OWNER/ADMIN/MEMBER roles. `seed.ts` only upserts the global
// Permission rows; granting them to a tenant's roles happens in
// RolesService.seedDefaultRolesForTenant(), which is otherwise only ever
// called once, at tenant registration (apps/api/.../auth.service.ts). A
// permission added after a tenant already exists (e.g. `analytics.read`)
// never reaches that tenant's roles without re-running this — same
// idempotent upsert logic as seedDefaultRolesForTenant, just looped over
// every tenant instead of one.
async function main() {
  const permissions = await prisma.permission.findMany();
  if (permissions.length === 0) {
    throw new Error('Global permissions not seeded. Run pnpm db:seed first.');
  }
  const allPermissionCodes = permissions.map((p) => p.code);
  const readOnlyPermissionCodes = allPermissionCodes.filter((code) => code.endsWith('.read'));
  const adminPermissionCodes = allPermissionCodes.filter((code) => !code.startsWith('tenant.') && !code.startsWith('roles.'));

  const tenants = await prisma.tenant.findMany({ select: { id: true } });

  for (const tenant of tenants) {
    const ownerRole = await prisma.role.upsert({
      where: { tenantId_name: { tenantId: tenant.id, name: 'OWNER' } },
      update: {},
      create: { tenantId: tenant.id, name: 'OWNER', isSystem: true },
    });
    for (const permission of permissions) {
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: ownerRole.id, permissionId: permission.id } },
        update: {},
        create: { roleId: ownerRole.id, permissionId: permission.id, scope: 'TENANT' },
      });
    }

    const adminRole = await prisma.role.upsert({
      where: { tenantId_name: { tenantId: tenant.id, name: 'ADMIN' } },
      update: {},
      create: { tenantId: tenant.id, name: 'ADMIN', isSystem: false },
    });
    for (const permission of permissions.filter((p) => adminPermissionCodes.includes(p.code))) {
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: adminRole.id, permissionId: permission.id } },
        update: {},
        create: { roleId: adminRole.id, permissionId: permission.id, scope: 'TENANT' },
      });
    }

    const memberRole = await prisma.role.upsert({
      where: { tenantId_name: { tenantId: tenant.id, name: 'MEMBER' } },
      update: {},
      create: { tenantId: tenant.id, name: 'MEMBER', isSystem: false },
    });
    for (const permission of permissions.filter((p) => readOnlyPermissionCodes.includes(p.code))) {
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: memberRole.id, permissionId: permission.id } },
        update: {},
        create: { roleId: memberRole.id, permissionId: permission.id, scope: 'BRANCH' },
      });
    }
  }

  console.log(`✓ Resynced role permissions for ${tenants.length} tenant(s)`);
}

main()
  .catch((e) => {
    console.error('Error resyncing role permissions:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
