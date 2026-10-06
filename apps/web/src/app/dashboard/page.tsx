'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { apiGet } from '@/lib/api-client';
import { Users, MessageSquare, ShoppingBag, DollarSign, CalendarDays } from 'lucide-react';
import type { AnalyticsOverview } from '@/lib/types';
import { StatCard } from '@/components/dashboard/widgets/stat-card';
import { ChannelDonut } from '@/components/dashboard/widgets/channel-donut';
import { SalesFunnel } from '@/components/dashboard/widgets/sales-funnel';
import { UpcomingAppointments } from '@/components/dashboard/widgets/upcoming-appointments';
import { RecentLeads } from '@/components/dashboard/widgets/recent-leads';
import { SalesByBranch } from '@/components/dashboard/widgets/sales-by-branch';
import { RecentActivity } from '@/components/dashboard/widgets/recent-activity';
import { QuickActions } from '@/components/dashboard/widgets/quick-actions';

export default function DashboardPage() {
  const { user, tokens } = useAuth();
  const firstName = user?.email?.split('@')[0] || 'Admin';
  const [overview, setOverview] = useState<AnalyticsOverview | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tokens) return;
    apiGet<AnalyticsOverview>('/analytics/overview', tokens.accessToken)
      .then(setOverview)
      .catch((err) => console.error('Error fetching dashboard analytics:', err))
      .finally(() => setLoading(false));
  }, [tokens]);

  if (loading || !overview) {
    return (
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-6 flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full" />
      </div>
    );
  }

  const stats = [
    {
      icon: Users,
      iconBg: '#dcfce7',
      iconColor: '#16a34a',
      label: 'Nuevos Leads',
      value: overview.stats.newLeads.value.toLocaleString('es-BO'),
      changePct: overview.stats.newLeads.changePct,
      sparklineColor: '#22c55e',
      sparklineData: overview.stats.newLeads.sparkline,
    },
    {
      icon: MessageSquare,
      iconBg: '#dbeafe',
      iconColor: '#2563eb',
      label: 'Conversaciones',
      value: overview.stats.conversations.value.toLocaleString('es-BO'),
      changePct: overview.stats.conversations.changePct,
      sparklineColor: '#3b82f6',
      sparklineData: overview.stats.conversations.sparkline,
    },
    {
      icon: ShoppingBag,
      iconBg: '#ede9fe',
      iconColor: '#7c3aed',
      label: 'Ventas (Pedidos)',
      value: overview.stats.orders.value.toLocaleString('es-BO'),
      changePct: overview.stats.orders.changePct,
      sparklineColor: '#a855f7',
      sparklineData: overview.stats.orders.sparkline,
    },
    {
      icon: DollarSign,
      iconBg: '#fef3c7',
      iconColor: '#d97706',
      label: 'Ingresos',
      value: `Bs. ${overview.stats.revenue.value.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      changePct: overview.stats.revenue.changePct,
      sparklineColor: '#f59e0b',
      sparklineData: overview.stats.revenue.sparkline,
    },
    {
      icon: CalendarDays,
      iconBg: '#fce7f3',
      iconColor: '#db2777',
      label: 'Citas Reservadas',
      value: overview.stats.appointments.value.toLocaleString('es-BO'),
      changePct: overview.stats.appointments.changePct,
      sparklineColor: '#ec4899',
      sparklineData: overview.stats.appointments.sparkline,
    },
  ];

  return (
    <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Welcome header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          ¡Bienvenido, {firstName.charAt(0).toUpperCase() + firstName.slice(1)}! 👋
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          Resumen de los últimos 7 días, comparado con los 7 días anteriores.
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {stats.map((s) => (
          <StatCard key={s.label} {...s} />
        ))}
      </div>

      {/* Row 2: donut + funnel + appointments */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 items-stretch">
        <ChannelDonut data={overview.channelBreakdown} />
        <SalesFunnel data={overview.orderFunnel} />
        <UpcomingAppointments appointments={overview.upcomingAppointments} />
      </div>

      {/* Row 3: leads + sales by branch + activity */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 items-stretch">
        <RecentLeads leads={overview.recentLeads} />
        <SalesByBranch data={overview.salesByBranch} />
        <RecentActivity activities={overview.recentActivity} />
      </div>

      {/* Quick actions */}
      <QuickActions />
    </div>
  );
}
