import { NotificationsService } from './notifications.service';
import { NotFoundError } from '@omniflow/utils';

describe('NotificationsService', () => {
  let service: NotificationsService;
  let prisma: any;
  let tenantContext: any;
  let eventEmitter: any;

  beforeEach(() => {
    prisma = {
      client: {
        user: { findMany: jest.fn() },
        notification: {
          createMany: jest.fn(),
          findMany: jest.fn(),
          count: jest.fn(),
          findUnique: jest.fn(),
          update: jest.fn(),
          updateMany: jest.fn(),
        },
      },
    };
    tenantContext = { getTenantId: jest.fn().mockReturnValue('tenant-1') };
    eventEmitter = { emit: jest.fn() };
    service = new NotificationsService(prisma, tenantContext, eventEmitter);
  });

  describe('create', () => {
    it('creates a single row when userId is given', async () => {
      await service.create({ userId: 'u1', type: 'order.pending_approval', title: 'Nuevo pedido' });
      expect(prisma.client.user.findMany).not.toHaveBeenCalled();
      expect(prisma.client.notification.createMany).toHaveBeenCalledWith({
        data: [{ userId: 'u1', type: 'order.pending_approval', title: 'Nuevo pedido', body: undefined, link: undefined }],
      });
    });

    it('fans out to every active user when userId is omitted', async () => {
      prisma.client.user.findMany.mockResolvedValue([{ id: 'u1' }, { id: 'u2' }]);
      await service.create({ type: 'order.pending_approval', title: 'Nuevo pedido' });
      expect(prisma.client.user.findMany).toHaveBeenCalledWith({ where: { status: 'ACTIVE' }, select: { id: true } });
      expect(prisma.client.notification.createMany).toHaveBeenCalledWith({
        data: [
          { userId: 'u1', type: 'order.pending_approval', title: 'Nuevo pedido', body: undefined, link: undefined },
          { userId: 'u2', type: 'order.pending_approval', title: 'Nuevo pedido', body: undefined, link: undefined },
        ],
      });
    });

    it('does nothing when there are no active users to notify', async () => {
      prisma.client.user.findMany.mockResolvedValue([]);
      await service.create({ type: 'order.pending_approval', title: 'Nuevo pedido' });
      expect(prisma.client.notification.createMany).not.toHaveBeenCalled();
      expect(eventEmitter.emit).not.toHaveBeenCalled();
    });

    it('emits notification.created for the current tenant so RealtimeGateway can push it live', async () => {
      await service.create({ userId: 'u1', type: 'order.confirmed', title: 'Nuevo pedido', body: 'Bs 100', link: '/dashboard/orders' });
      expect(eventEmitter.emit).toHaveBeenCalledWith('notification.created', {
        tenantId: 'tenant-1',
        title: 'Nuevo pedido',
        body: 'Bs 100',
        link: '/dashboard/orders',
      });
    });

    it('does not emit when there is no tenant in context', async () => {
      tenantContext.getTenantId.mockReturnValue(undefined);
      await service.create({ userId: 'u1', type: 'order.confirmed', title: 'Nuevo pedido' });
      expect(eventEmitter.emit).not.toHaveBeenCalled();
    });
  });

  describe('list/unreadCount', () => {
    it('lists notifications for the given user, newest first', async () => {
      prisma.client.notification.findMany.mockResolvedValue([]);
      await service.list('u1');
      expect(prisma.client.notification.findMany).toHaveBeenCalledWith({
        where: { userId: 'u1' },
        orderBy: { createdAt: 'desc' },
        take: 50,
      });
    });

    it('filters to unread only when requested', async () => {
      prisma.client.notification.findMany.mockResolvedValue([]);
      await service.list('u1', { unreadOnly: true });
      expect(prisma.client.notification.findMany).toHaveBeenCalledWith({
        where: { userId: 'u1', readAt: null },
        orderBy: { createdAt: 'desc' },
        take: 50,
      });
    });

    it('counts unread notifications for the user', async () => {
      prisma.client.notification.count.mockResolvedValue(3);
      await expect(service.unreadCount('u1')).resolves.toBe(3);
      expect(prisma.client.notification.count).toHaveBeenCalledWith({ where: { userId: 'u1', readAt: null } });
    });
  });

  describe('markRead', () => {
    it('throws NotFoundError when the notification does not belong to the user', async () => {
      prisma.client.notification.findUnique.mockResolvedValue({ id: 'n1', userId: 'other-user' });
      await expect(service.markRead('n1', 'u1')).rejects.toThrow(NotFoundError);
    });

    it('throws NotFoundError when the notification does not exist', async () => {
      prisma.client.notification.findUnique.mockResolvedValue(null);
      await expect(service.markRead('missing', 'u1')).rejects.toThrow(NotFoundError);
    });

    it('marks the notification read', async () => {
      prisma.client.notification.findUnique.mockResolvedValue({ id: 'n1', userId: 'u1' });
      await service.markRead('n1', 'u1');
      expect(prisma.client.notification.update).toHaveBeenCalledWith({
        where: { id: 'n1' },
        data: { readAt: expect.any(Date) },
      });
    });
  });

  describe('markAllRead', () => {
    it('marks every unread notification for the user as read', async () => {
      await service.markAllRead('u1');
      expect(prisma.client.notification.updateMany).toHaveBeenCalledWith({
        where: { userId: 'u1', readAt: null },
        data: { readAt: expect.any(Date) },
      });
    });
  });
});
