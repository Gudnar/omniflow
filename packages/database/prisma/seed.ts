import { PrismaClient } from '../src/prisma';

const prisma = new PrismaClient();

async function main() {
  const permissions = [
    { code: 'tenant.manage', description: 'Manage tenant settings' },
    { code: 'users.read', description: 'Read users' },
    { code: 'users.manage', description: 'Create, update, delete users' },
    { code: 'roles.read', description: 'Read roles' },
    { code: 'roles.manage', description: 'Create, update, delete roles' },
    { code: 'branches.read', description: 'Read branches' },
    { code: 'branches.manage', description: 'Create, update, delete branches' },
  ];

  for (const perm of permissions) {
    await prisma.permission.upsert({
      where: { code: perm.code },
      update: { description: perm.description },
      create: perm,
    });
  }

  console.log('✓ Permissions seeded successfully');
}

main()
  .catch((e) => {
    console.error('Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
