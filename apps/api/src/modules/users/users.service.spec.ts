import { UsersService } from './users.service';
import { ConflictError, NotFoundError, ValidationError } from '@omniflow/utils';

jest.mock('argon2', () => ({ hash: jest.fn().mockResolvedValue('hashed-password') }));

function userRow(overrides: any = {}) {
  return {
    id: 'u1',
    email: 'colega@demo.com',
    status: 'ACTIVE',
    mfaEnabled: false,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    roles: [{ role: { id: 'r1', name: 'Despachador' } }],
    branches: [{ branch: { id: 'b1', name: 'Sucursal Centro' } }],
    ...overrides,
  };
}

describe('UsersService', () => {
  let service: UsersService;
  let prisma: any;
  let tx: any;

  beforeEach(() => {
    tx = {
      user: { create: jest.fn(), update: jest.fn(), findUnique: jest.fn() },
      userRole: { createMany: jest.fn(), deleteMany: jest.fn() },
      userBranch: { createMany: jest.fn(), deleteMany: jest.fn() },
    };
    prisma = {
      raw: { user: { findUnique: jest.fn() } },
      client: {
        user: { findUnique: jest.fn(), findMany: jest.fn() },
        role: { count: jest.fn() },
        branch: { count: jest.fn() },
        $transaction: jest.fn((cb: any) => cb(tx)),
      },
    };
    service = new UsersService(prisma);
  });

  describe('getUserById / listUsersByTenant', () => {
    it('throws NotFoundError when the user does not exist', async () => {
      prisma.client.user.findUnique.mockResolvedValue(null);
      await expect(service.getUserById('missing')).rejects.toThrow(NotFoundError);
    });

    it('flattens the roles/branches join rows into plain arrays', async () => {
      prisma.client.user.findUnique.mockResolvedValue(userRow());
      const result = await service.getUserById('u1');
      expect(result.roles).toEqual([{ id: 'r1', name: 'Despachador' }]);
      expect(result.branches).toEqual([{ id: 'b1', name: 'Sucursal Centro' }]);
    });

    it('lists every user for the tenant, flattened the same way', async () => {
      prisma.client.user.findMany.mockResolvedValue([userRow()]);
      const result = await service.listUsersByTenant('t1');
      expect(prisma.client.user.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { tenantId: 't1' } }));
      expect(result[0].roles).toEqual([{ id: 'r1', name: 'Despachador' }]);
    });
  });

  describe('create', () => {
    it('rejects an email already registered (any tenant)', async () => {
      prisma.raw.user.findUnique.mockResolvedValue({ id: 'existing' });
      await expect(
        service.create('t1', { email: 'colega@demo.com', password: 'longpass1', roleIds: ['r1'], branchIds: [] }),
      ).rejects.toThrow(ConflictError);
    });

    it('rejects a roleId that does not belong to this tenant', async () => {
      prisma.raw.user.findUnique.mockResolvedValue(null);
      prisma.client.role.count.mockResolvedValue(0);
      await expect(
        service.create('t1', { email: 'nuevo@demo.com', password: 'longpass1', roleIds: ['other-tenants-role'], branchIds: [] }),
      ).rejects.toThrow(ValidationError);
    });

    it('rejects creating a user with no roles at all', async () => {
      prisma.raw.user.findUnique.mockResolvedValue(null);
      await expect(
        service.create('t1', { email: 'nuevo@demo.com', password: 'longpass1', roleIds: [], branchIds: [] }),
      ).rejects.toThrow(ValidationError);
    });

    it('hashes the password and creates the User + UserRole + UserBranch rows', async () => {
      prisma.raw.user.findUnique.mockResolvedValue(null);
      prisma.client.role.count.mockResolvedValue(1);
      prisma.client.branch.count.mockResolvedValue(1);
      tx.user.create.mockResolvedValue({ id: 'u1' });
      tx.user.findUnique.mockResolvedValue(userRow());

      await service.create('t1', { email: 'colega@demo.com', password: 'longpass1', roleIds: ['r1'], branchIds: ['b1'] });

      expect(tx.user.create).toHaveBeenCalledWith({
        data: { tenantId: 't1', email: 'colega@demo.com', passwordHash: 'hashed-password', status: 'ACTIVE' },
      });
      expect(tx.userRole.createMany).toHaveBeenCalledWith({ data: [{ userId: 'u1', roleId: 'r1' }] });
      expect(tx.userBranch.createMany).toHaveBeenCalledWith({ data: [{ userId: 'u1', branchId: 'b1', tenantId: 't1' }] });
    });

    it('creates no UserBranch rows when branchIds is empty — unrestricted, every branch', async () => {
      prisma.raw.user.findUnique.mockResolvedValue(null);
      prisma.client.role.count.mockResolvedValue(1);
      tx.user.create.mockResolvedValue({ id: 'u1' });
      tx.user.findUnique.mockResolvedValue(userRow({ branches: [] }));

      await service.create('t1', { email: 'colega@demo.com', password: 'longpass1', roleIds: ['r1'], branchIds: [] });

      expect(tx.userBranch.createMany).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('throws NotFoundError when the user does not exist', async () => {
      prisma.client.user.findUnique.mockResolvedValue(null);
      await expect(service.update('missing', 't1', { status: 'DISABLED' })).rejects.toThrow(NotFoundError);
    });

    it('allows clearing all roles (an empty roleIds array), unlike create()', async () => {
      prisma.client.user.findUnique.mockResolvedValue(userRow());
      tx.user.findUnique.mockResolvedValue(userRow({ roles: [] }));

      await service.update('u1', 't1', { roleIds: [] });

      expect(tx.userRole.deleteMany).toHaveBeenCalledWith({ where: { userId: 'u1' } });
      expect(tx.userRole.createMany).not.toHaveBeenCalled();
    });

    it('updates status, and replaces roles/branches when provided', async () => {
      prisma.client.user.findUnique.mockResolvedValue(userRow());
      prisma.client.role.count.mockResolvedValue(1);
      prisma.client.branch.count.mockResolvedValue(1);
      tx.user.findUnique.mockResolvedValue(userRow());

      await service.update('u1', 't1', { status: 'DISABLED', roleIds: ['r2'], branchIds: ['b2'] });

      expect(tx.user.update).toHaveBeenCalledWith({ where: { id: 'u1' }, data: { status: 'DISABLED' } });
      expect(tx.userRole.deleteMany).toHaveBeenCalledWith({ where: { userId: 'u1' } });
      expect(tx.userRole.createMany).toHaveBeenCalledWith({ data: [{ userId: 'u1', roleId: 'r2' }] });
      expect(tx.userBranch.deleteMany).toHaveBeenCalledWith({ where: { userId: 'u1' } });
      expect(tx.userBranch.createMany).toHaveBeenCalledWith({ data: [{ userId: 'u1', branchId: 'b2', tenantId: 't1' }] });
    });
  });
});
