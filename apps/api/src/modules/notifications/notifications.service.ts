import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContextService } from '../tenant-context/tenant-context.service';
import { NotFoundError } from '@omniflow/utils';

export interface CreateNotificationInput {
  // Omitted => fan out one row per ACTIVE user in the tenant (a "broadcast").
  userId?: string;
  type: string;
  title: string;
  body?: string;
  link?: string;
}

@Injectable()
export class NotificationsService {
  constructor(
    private prisma: PrismaService,
    private tenantContext: TenantContextService,
    private eventEmitter: EventEmitter2,
  ) {}

  async create(dto: CreateNotificationInput) {
    const targetUserIds = dto.userId
      ? [dto.userId]
      : (await this.prisma.client.user.findMany({ where: { status: 'ACTIVE' }, select: { id: true } })).map(
          (u: any) => u.id,
        );

    if (!targetUserIds.length) return;

    await this.prisma.client.notification.createMany({
      data: targetUserIds.map((userId: string) => ({
        userId,
        type: dto.type,
        title: dto.title,
        body: dto.body,
        link: dto.link,
      })),
    });

    // Lets RealtimeGateway push this to every connected staff member in the
    // tenant immediately — see its `notification.created` handler — instead
    // of everyone waiting on the bell's 30s poll.
    const tenantId = this.tenantContext.getTenantId();
    if (tenantId) {
      this.eventEmitter.emit('notification.created', {
        tenantId,
        title: dto.title,
        body: dto.body,
        link: dto.link,
      });
    }
  }

  async list(userId: string, opts: { unreadOnly?: boolean } = {}) {
    return this.prisma.client.notification.findMany({
      where: { userId, ...(opts.unreadOnly && { readAt: null }) },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async unreadCount(userId: string) {
    return this.prisma.client.notification.count({ where: { userId, readAt: null } });
  }

  async markRead(id: string, userId: string) {
    const notification = await this.prisma.client.notification.findUnique({ where: { id } });
    if (!notification || notification.userId !== userId) throw new NotFoundError('Notification');
    return this.prisma.client.notification.update({ where: { id }, data: { readAt: new Date() } });
  }

  async markAllRead(userId: string) {
    await this.prisma.client.notification.updateMany({ where: { userId, readAt: null }, data: { readAt: new Date() } });
    return { success: true };
  }
}
