import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const SPARKLINE_DAYS = 10;
const TREND_WINDOW_DAYS = 7;
const HISTORY_DAYS = TREND_WINDOW_DAYS * 2; // enough to compare this week vs the previous one

// Buckets a list of timestamps into `days` daily counts, oldest first —
// index `days - 1` is always "today". Used for both the dashboard
// sparklines (last SPARKLINE_DAYS) and the week-over-week comparison (first
// half vs second half of a HISTORY_DAYS window), so one query's result
// serves both without re-fetching.
function bucketCountByDay(timestamps: Date[], days: number, now: Date): number[] {
  const buckets = Array(days).fill(0);
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const dayMs = 24 * 60 * 60 * 1000;
  for (const ts of timestamps) {
    const startOfTsDay = new Date(ts);
    startOfTsDay.setHours(0, 0, 0, 0);
    const diffDays = Math.round((startOfToday.getTime() - startOfTsDay.getTime()) / dayMs);
    const idx = days - 1 - diffDays;
    if (idx >= 0 && idx < days) buckets[idx]++;
  }
  return buckets;
}

function bucketSumByDay(entries: { createdAt: Date; amount: number }[], days: number, now: Date): number[] {
  const buckets = Array(days).fill(0);
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const dayMs = 24 * 60 * 60 * 1000;
  for (const { createdAt, amount } of entries) {
    const startOfTsDay = new Date(createdAt);
    startOfTsDay.setHours(0, 0, 0, 0);
    const diffDays = Math.round((startOfToday.getTime() - startOfTsDay.getTime()) / dayMs);
    const idx = days - 1 - diffDays;
    if (idx >= 0 && idx < days) buckets[idx] += amount;
  }
  return buckets;
}

function sum(values: number[]): number {
  return values.reduce((a, b) => a + b, 0);
}

// Shared shape for every stat card: this week's total, the % change vs the
// previous 7-day window (null when there's nothing to compare against,
// rather than a misleading "+100%"/"0%"), and a 10-day sparkline.
function buildTrend(dailyCounts: number[]) {
  const sparkline = dailyCounts.slice(HISTORY_DAYS - SPARKLINE_DAYS);
  const current = sum(dailyCounts.slice(TREND_WINDOW_DAYS));
  const previous = sum(dailyCounts.slice(0, TREND_WINDOW_DAYS));
  const changePct = previous === 0 ? null : Math.round(((current - previous) / previous) * 1000) / 10;
  return { value: current, changePct, sparkline };
}

@Injectable()
export class AnalyticsService {
  constructor(private prisma: PrismaService) {}

  async getOverview() {
    const now = new Date();
    const historyStart = new Date(now.getTime() - HISTORY_DAYS * 24 * 60 * 60 * 1000);

    const [leads, conversations, orders, appointments, channelGroups, statusGroups, upcomingAppointments, recentLeads, branchSales, recentActivity] =
      await Promise.all([
        this.prisma.client.contact.findMany({ where: { type: 'LEAD', createdAt: { gte: historyStart } }, select: { createdAt: true } }),
        this.prisma.client.conversation.findMany({ where: { createdAt: { gte: historyStart } }, select: { createdAt: true } }),
        this.prisma.client.order.findMany({
          where: { status: { not: 'CANCELLED' }, createdAt: { gte: historyStart } },
          select: { createdAt: true, total: true },
        }),
        this.prisma.client.appointment.findMany({
          where: { status: { not: 'CANCELLED' }, createdAt: { gte: historyStart } },
          select: { createdAt: true },
        }),
        this.prisma.client.conversation.groupBy({ by: ['channel'], _count: { _all: true } }),
        this.prisma.client.order.groupBy({ by: ['status'], _count: { _all: true } }),
        this.prisma.client.appointment.findMany({
          where: { status: { in: ['PENDING', 'CONFIRMED'] }, startAt: { gte: now } },
          orderBy: { startAt: 'asc' },
          take: 5,
          include: { contact: { select: { id: true, name: true } }, services: { select: { serviceNameSnapshot: true } } },
        }),
        this.prisma.client.contact.findMany({
          where: { type: 'LEAD' },
          orderBy: { createdAt: 'desc' },
          take: 5,
          select: { id: true, name: true, phone: true, createdAt: true },
        }),
        this.prisma.client.order.groupBy({
          by: ['branchId'],
          where: { status: { not: 'CANCELLED' }, createdAt: { gte: new Date(now.getTime() - TREND_WINDOW_DAYS * 24 * 60 * 60 * 1000) } },
          _sum: { total: true },
        }),
        this.prisma.client.activity.findMany({
          orderBy: { occurredAt: 'desc' },
          take: 8,
          include: { contact: { select: { id: true, name: true } } },
        }),
      ]);

    const revenueDaily = bucketSumByDay(
      orders.map((o: any) => ({ createdAt: o.createdAt, amount: Number(o.total) })),
      HISTORY_DAYS,
      now,
    );

    const branchIds = branchSales.map((g: any) => g.branchId).filter((id: any): id is string => !!id);
    const branches = branchIds.length
      ? await this.prisma.client.branch.findMany({ where: { id: { in: branchIds } }, select: { id: true, name: true } })
      : [];
    const branchNameById = new Map(branches.map((b: any) => [b.id, b.name]));

    return {
      stats: {
        newLeads: buildTrend(bucketCountByDay(leads.map((l: any) => l.createdAt), HISTORY_DAYS, now)),
        conversations: buildTrend(bucketCountByDay(conversations.map((c: any) => c.createdAt), HISTORY_DAYS, now)),
        orders: buildTrend(bucketCountByDay(orders.map((o: any) => o.createdAt), HISTORY_DAYS, now)),
        revenue: buildTrend(revenueDaily),
        appointments: buildTrend(bucketCountByDay(appointments.map((a: any) => a.createdAt), HISTORY_DAYS, now)),
      },
      channelBreakdown: channelGroups.map((g: any) => ({ channel: g.channel, count: g._count._all })),
      orderFunnel: statusGroups.map((g: any) => ({ status: g.status, count: g._count._all })),
      upcomingAppointments: upcomingAppointments.map((a: any) => ({
        id: a.id,
        contactName: a.contact.name,
        serviceName: a.services[0]?.serviceNameSnapshot ?? null,
        startAt: a.startAt,
        status: a.status,
      })),
      recentLeads: recentLeads.map((l: any) => ({ id: l.id, name: l.name, phone: l.phone, createdAt: l.createdAt })),
      salesByBranch: branchSales
        .filter((g: any) => g.branchId)
        .map((g: any) => ({ branchId: g.branchId, branchName: branchNameById.get(g.branchId) ?? 'Sin sucursal', total: Number(g._sum.total ?? 0) })),
      recentActivity: recentActivity.map((a: any) => ({
        id: a.id,
        type: a.type,
        subject: a.subject,
        description: a.description,
        contactName: a.contact.name,
        occurredAt: a.occurredAt,
      })),
    };
  }
}
