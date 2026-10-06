import { AnalyticsService } from './analytics.service';

describe('AnalyticsService', () => {
  let service: AnalyticsService;
  let prisma: any;

  const emptyFindMany = () => Promise.resolve([]);

  beforeEach(() => {
    prisma = {
      client: {
        contact: { findMany: jest.fn(emptyFindMany) },
        conversation: { findMany: jest.fn(emptyFindMany), groupBy: jest.fn().mockResolvedValue([]) },
        order: { findMany: jest.fn(emptyFindMany), groupBy: jest.fn().mockResolvedValue([]) },
        appointment: { findMany: jest.fn(emptyFindMany) },
        activity: { findMany: jest.fn(emptyFindMany) },
        branch: { findMany: jest.fn(emptyFindMany) },
      },
    };
    service = new AnalyticsService(prisma);
  });

  it('returns zeroed stats with no changePct (never a misleading divide-by-zero %) when there is no history at all', async () => {
    const result = await service.getOverview();

    expect(result.stats.newLeads).toEqual({ value: 0, changePct: null, sparkline: Array(10).fill(0) });
    expect(result.stats.conversations.value).toBe(0);
    expect(result.stats.orders.value).toBe(0);
    expect(result.stats.revenue.value).toBe(0);
    expect(result.stats.appointments.value).toBe(0);
  });

  it('counts leads created in the last 7 days as `value`, and computes changePct against the prior 7 days', async () => {
    const now = new Date();
    const daysAgo = (n: number) => new Date(now.getTime() - n * 24 * 60 * 60 * 1000);
    // 2 leads in the previous week (days 8-9 ago), 4 in the current week (days 1-2 ago)
    prisma.client.contact.findMany.mockImplementation(({ where }: any) => {
      if (where.type !== 'LEAD') return Promise.resolve([]);
      return Promise.resolve([
        { createdAt: daysAgo(9) },
        { createdAt: daysAgo(8) },
        { createdAt: daysAgo(2) },
        { createdAt: daysAgo(2) },
        { createdAt: daysAgo(1) },
        { createdAt: daysAgo(1) },
      ]);
    });

    const result = await service.getOverview();

    expect(result.stats.newLeads.value).toBe(4);
    // (4 - 2) / 2 * 100 = 100%
    expect(result.stats.newLeads.changePct).toBe(100);
    expect(result.stats.newLeads.sparkline).toHaveLength(10);
  });

  it('excludes CANCELLED orders from the orders count and revenue sum', async () => {
    const now = new Date();
    const daysAgo = (n: number) => new Date(now.getTime() - n * 24 * 60 * 60 * 1000);
    prisma.client.order.findMany.mockImplementation(({ where }: any) => {
      // The service queries with status: { not: 'CANCELLED' } — assert the
      // filter itself is correct, then return data as if it were applied.
      expect(where.status).toEqual({ not: 'CANCELLED' });
      return Promise.resolve([
        { createdAt: daysAgo(1), total: '100.00' },
        { createdAt: daysAgo(2), total: '50.50' },
      ]);
    });

    const result = await service.getOverview();

    expect(result.stats.orders.value).toBe(2);
    expect(result.stats.revenue.value).toBe(150.5);
  });

  it('maps channel/order-status groupBy results into plain {label, count} arrays', async () => {
    prisma.client.conversation.groupBy.mockResolvedValue([
      { channel: 'WHATSAPP', _count: { _all: 12 } },
      { channel: 'INSTAGRAM', _count: { _all: 3 } },
    ]);
    prisma.client.order.groupBy.mockImplementation(({ by }: any) => {
      if (by[0] === 'status') {
        return Promise.resolve([
          { status: 'PENDING', _count: { _all: 2 } },
          { status: 'DELIVERED', _count: { _all: 5 } },
        ]);
      }
      return Promise.resolve([]);
    });

    const result = await service.getOverview();

    expect(result.channelBreakdown).toEqual([
      { channel: 'WHATSAPP', count: 12 },
      { channel: 'INSTAGRAM', count: 3 },
    ]);
    expect(result.orderFunnel).toEqual([
      { status: 'PENDING', count: 2 },
      { status: 'DELIVERED', count: 5 },
    ]);
  });

  it('resolves branch names for the sales-by-branch breakdown and drops orders with no branch', async () => {
    prisma.client.order.groupBy.mockImplementation(({ by }: any) => {
      if (by[0] === 'branchId') {
        return Promise.resolve([
          { branchId: 'b1', _sum: { total: '300.00' } },
          { branchId: null, _sum: { total: '20.00' } },
        ]);
      }
      return Promise.resolve([]);
    });
    prisma.client.branch.findMany.mockResolvedValue([{ id: 'b1', name: 'Sucursal Centro' }]);

    const result = await service.getOverview();

    expect(result.salesByBranch).toEqual([{ branchId: 'b1', branchName: 'Sucursal Centro', total: 300 }]);
  });

  it('includes the contact name on each recent activity entry', async () => {
    prisma.client.activity.findMany.mockResolvedValue([
      { id: 'a1', type: 'CALL', subject: 'Llamada de seguimiento', description: null, occurredAt: new Date(), contact: { id: 'c1', name: 'Ana Pérez' } },
    ]);

    const result = await service.getOverview();

    expect(result.recentActivity).toEqual([
      { id: 'a1', type: 'CALL', subject: 'Llamada de seguimiento', description: null, contactName: 'Ana Pérez', occurredAt: expect.any(Date) },
    ]);
  });

  it('flattens upcoming appointments with the contact and first service snapshot', async () => {
    const startAt = new Date();
    prisma.client.appointment.findMany.mockImplementation(({ where }: any) => {
      if (!where.startAt) return Promise.resolve([]);
      return Promise.resolve([
        { id: 'ap1', startAt, status: 'CONFIRMED', contact: { id: 'c1', name: 'Luis Gómez' }, services: [{ serviceNameSnapshot: 'Corte de cabello' }] },
      ]);
    });

    const result = await service.getOverview();

    expect(result.upcomingAppointments).toEqual([
      { id: 'ap1', contactName: 'Luis Gómez', serviceName: 'Corte de cabello', startAt, status: 'CONFIRMED' },
    ]);
  });
});
