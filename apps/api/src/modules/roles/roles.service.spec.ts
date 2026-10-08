import { RolesService } from './roles.service';
import { NotFoundError, ValidationError } from '@omniflow/utils';

describe('RolesService', () => {
  let service: RolesService;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      client: {
        role: { findMany: jest.fn(), findUnique: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn() },
        permission: { findMany: jest.fn() },
        rolePermission: { deleteMany: jest.fn(), createMany: jest.fn() },
        userRole: { count: jest.fn() },
        $transaction: jest.fn((ops: any[]) => Promise.all(ops)),
      },
    };
    service = new RolesService(prisma);
  });

  describe('list', () => {
    it('lists every role for the tenant with its permissions', async () => {
      prisma.client.role.findMany.mockResolvedValue([{ id: 'r1', name: 'Despachador' }]);
      const result = await service.list();
      expect(prisma.client.role.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ include: { permissions: { include: { permission: true } } } }),
      );
      expect(result).toEqual([{ id: 'r1', name: 'Despachador' }]);
    });
  });

  describe('getPermissionsCatalog', () => {
    it('returns the full permission catalog, ordered by code', async () => {
      prisma.client.permission.findMany.mockResolvedValue([{ code: 'orders.approve' }]);
      const result = await service.getPermissionsCatalog();
      expect(prisma.client.permission.findMany).toHaveBeenCalledWith({ orderBy: { code: 'asc' } });
      expect(result).toEqual([{ code: 'orders.approve' }]);
    });
  });

  describe('create', () => {
    it('rejects a permission code that does not exist in the catalog', async () => {
      prisma.client.permission.findMany.mockResolvedValue([{ id: 'p1', code: 'orders.approve' }]);
      await expect(
        service.create('t1', { name: 'Despachador', permissionCodes: ['orders.approve', 'made.up'] }),
      ).rejects.toThrow(ValidationError);
      expect(prisma.client.role.create).not.toHaveBeenCalled();
    });

    it('creates a non-system TENANT-scoped role with the resolved permission ids', async () => {
      prisma.client.permission.findMany.mockResolvedValue([
        { id: 'p1', code: 'orders.approve' },
        { id: 'p2', code: 'orders.fulfill' },
      ]);
      prisma.client.role.create.mockResolvedValue({ id: 'r1', name: 'Despachador' });

      await service.create('t1', { name: 'Despachador', permissionCodes: ['orders.approve', 'orders.fulfill'] });

      expect(prisma.client.role.create).toHaveBeenCalledWith({
        data: {
          tenantId: 't1',
          name: 'Despachador',
          isSystem: false,
          permissions: {
            create: [
              { permissionId: 'p1', scope: 'TENANT' },
              { permissionId: 'p2', scope: 'TENANT' },
            ],
          },
        },
        include: { permissions: { include: { permission: true } } },
      });
    });
  });

  describe('update / delete — system role protection', () => {
    it('throws NotFoundError when the role does not exist', async () => {
      prisma.client.role.findUnique.mockResolvedValue(null);
      await expect(service.update('missing', { name: 'x' })).rejects.toThrow(NotFoundError);
    });

    it('rejects editing a system role', async () => {
      prisma.client.role.findUnique.mockResolvedValue({ id: 'r1', isSystem: true });
      await expect(service.update('r1', { name: 'Hacked OWNER' })).rejects.toThrow(ValidationError);
    });

    it('rejects deleting a system role', async () => {
      prisma.client.role.findUnique.mockResolvedValue({ id: 'r1', isSystem: true });
      await expect(service.delete('r1')).rejects.toThrow(ValidationError);
    });

    it('rejects deleting a role that still has users assigned', async () => {
      prisma.client.role.findUnique.mockResolvedValue({ id: 'r1', isSystem: false });
      prisma.client.userRole.count.mockResolvedValue(2);
      await expect(service.delete('r1')).rejects.toThrow(ValidationError);
      expect(prisma.client.role.delete).not.toHaveBeenCalled();
    });

    it('deletes a non-system role with no users assigned', async () => {
      prisma.client.role.findUnique.mockResolvedValue({ id: 'r1', isSystem: false });
      prisma.client.userRole.count.mockResolvedValue(0);
      const result = await service.delete('r1');
      expect(prisma.client.role.delete).toHaveBeenCalledWith({ where: { id: 'r1' } });
      expect(result).toEqual({ success: true });
    });

    it('updates name and replaces permissions for an editable role', async () => {
      prisma.client.role.findUnique.mockResolvedValue({ id: 'r1', isSystem: false });
      prisma.client.permission.findMany.mockResolvedValue([{ id: 'p1', code: 'orders.cancel' }]);
      prisma.client.role.update.mockResolvedValue({ id: 'r1', name: 'Anuladores' });

      await service.update('r1', { name: 'Anuladores', permissionCodes: ['orders.cancel'] });

      expect(prisma.client.rolePermission.deleteMany).toHaveBeenCalledWith({ where: { roleId: 'r1' } });
      expect(prisma.client.rolePermission.createMany).toHaveBeenCalledWith({
        data: [{ roleId: 'r1', permissionId: 'p1', scope: 'TENANT' }],
      });
      expect(prisma.client.role.update).toHaveBeenCalledWith({
        where: { id: 'r1' },
        data: { name: 'Anuladores' },
        include: { permissions: { include: { permission: true } } },
      });
    });
  });
});
