-- OmniFlow Seed Data
-- Run this with: psql -U postgres -d omniflow_dev -f seed-data.sql

-- Create Tenant
INSERT INTO "Tenant" (id, name, slug, status, "createdAt", "updatedAt")
VALUES (
  'tenant-demo-001',
  'Demo Company',
  'demo-company',
  'ACTIVE',
  NOW(),
  NOW()
)
ON CONFLICT DO NOTHING;

-- Create Permissions
INSERT INTO "Permission" (id, code, description, "createdAt", "updatedAt") VALUES
('perm-001', 'tenant.manage', 'Manage tenant settings', NOW(), NOW()),
('perm-002', 'users.read', 'Read users', NOW(), NOW()),
('perm-003', 'users.manage', 'Create, update, delete users', NOW(), NOW()),
('perm-004', 'roles.read', 'Read roles', NOW(), NOW()),
('perm-005', 'roles.manage', 'Create, update, delete roles', NOW(), NOW()),
('perm-006', 'branches.read', 'Read branches', NOW(), NOW()),
('perm-007', 'branches.manage', 'Create, update, delete branches', NOW(), NOW())
ON CONFLICT DO NOTHING;

-- Create Admin Role
INSERT INTO "Role" (id, "tenantId", name, "isSystem", "createdAt", "updatedAt")
VALUES (
  'role-admin-001',
  'tenant-demo-001',
  'ADMIN',
  true,
  NOW(),
  NOW()
)
ON CONFLICT DO NOTHING;

-- Assign Permissions to Admin Role
INSERT INTO "RolePermission" ("roleId", "permissionId", scope)
SELECT 'role-admin-001', id, 'TENANT'
FROM "Permission"
WHERE code IN ('tenant.manage', 'users.read', 'users.manage', 'roles.read', 'roles.manage', 'branches.read', 'branches.manage')
ON CONFLICT DO NOTHING;

-- Create Test User (password: Test123456!)
-- Using pre-hashed password (argon2): $argon2id$v=19$m=19456,t=2,p=1$pDcXwGvBrXvgnUqI/cNvIg$c/FwVVFN5FT6YSLuWWQT3K5PqZxGWYKBLi0LGVPM2QY
INSERT INTO "User" (
  id,
  "tenantId",
  email,
  "passwordHash",
  status,
  "mfaEnabled",
  "createdAt",
  "updatedAt"
)
VALUES (
  'user-admin-001',
  'tenant-demo-001',
  'admin@example.com',
  '$argon2id$v=19$m=19456,t=2,p=1$pDcXwGvBrXvgnUqI/cNvIg$c/FwVVFN5FT6YSLuWWQT3K5PqZxGWYKBLi0LGVPM2QY',
  'ACTIVE',
  false,
  NOW(),
  NOW()
)
ON CONFLICT DO NOTHING;

-- Assign Admin Role to User
INSERT INTO "UserRole" ("userId", "roleId")
VALUES ('user-admin-001', 'role-admin-001')
ON CONFLICT DO NOTHING;

-- Create Test Branch
INSERT INTO "Branch" (id, "tenantId", name, slug, status, address, timezone, "createdAt", "updatedAt")
VALUES (
  'branch-001',
  'tenant-demo-001',
  'Sucursal Principal',
  'sucursal-principal',
  'ACTIVE',
  'Calle Principal 123',
  'America/La_Paz',
  NOW(),
  NOW()
)
ON CONFLICT DO NOTHING;

-- Assign User to Branch
INSERT INTO "UserBranch" ("userId", "branchId", "tenantId", "createdAt")
VALUES ('user-admin-001', 'branch-001', 'tenant-demo-001', NOW())
ON CONFLICT DO NOTHING;

-- Success Message
SELECT 'Seed data loaded successfully!' as message;
SELECT 'Login with: admin@example.com / Test123456!' as credentials;
