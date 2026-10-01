'use client';

import { useAuth } from '@/lib/auth-context';
import { Users, MessageSquare, ShoppingBag, DollarSign, CalendarDays, Calendar } from 'lucide-react';
import { StatCard } from '@/components/dashboard/widgets/stat-card';
import { ChannelDonut } from '@/components/dashboard/widgets/channel-donut';
import { SalesFunnel } from '@/components/dashboard/widgets/sales-funnel';
import { UpcomingAppointments } from '@/components/dashboard/widgets/upcoming-appointments';
import { RecentLeads } from '@/components/dashboard/widgets/recent-leads';
import { SalesByBranch } from '@/components/dashboard/widgets/sales-by-branch';
import { RecentActivity } from '@/components/dashboard/widgets/recent-activity';
import { QuickActions } from '@/components/dashboard/widgets/quick-actions';

const stats = [
  {
    icon: Users,
    iconBg: '#dcfce7',
    iconColor: '#16a34a',
    label: 'Nuevos Leads',
    value: '1,250',
    change: '18.5%',
    sparklineColor: '#22c55e',
    sparklineData: [4, 6, 5, 8, 7, 10, 9, 12, 11, 14],
  },
  {
    icon: MessageSquare,
    iconBg: '#dbeafe',
    iconColor: '#2563eb',
    label: 'Conversaciones',
    value: '3,842',
    change: '22.7%',
    sparklineColor: '#3b82f6',
    sparklineData: [8, 7, 10, 9, 13, 11, 15, 14, 17, 19],
  },
  {
    icon: ShoppingBag,
    iconBg: '#ede9fe',
    iconColor: '#7c3aed',
    label: 'Ventas (Pedidos)',
    value: '532',
    change: '15.3%',
    sparklineColor: '#a855f7',
    sparklineData: [5, 6, 5, 7, 6, 8, 9, 8, 10, 11],
  },
  {
    icon: DollarSign,
    iconBg: '#fef3c7',
    iconColor: '#d97706',
    label: 'Ingresos',
    value: 'Bs. 245,780',
    change: '20.1%',
    sparklineColor: '#f59e0b',
    sparklineData: [6, 8, 7, 9, 8, 11, 10, 13, 12, 15],
  },
  {
    icon: CalendarDays,
    iconBg: '#fce7f3',
    iconColor: '#db2777',
    label: 'Citas Reservadas',
    value: '158',
    change: '12.8%',
    sparklineColor: '#ec4899',
    sparklineData: [3, 4, 4, 5, 5, 6, 6, 7, 7, 8],
  },
];

export default function DashboardPage() {
  const { user } = useAuth();
  const firstName = user?.email?.split('@')[0] || 'Admin';

  return (
    <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Welcome header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            ¡Bienvenido, {firstName.charAt(0).toUpperCase() + firstName.slice(1)}! 👋
          </h1>
          <p className="text-gray-500 text-sm mt-1">Aquí tienes un resumen general de tu negocio.</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition self-start sm:self-auto">
          <Calendar className="w-4 h-4 text-gray-400" />
          1 Jun - 7 Jun, 2025
        </button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {stats.map((s) => (
          <StatCard key={s.label} {...s} />
        ))}
      </div>

      {/* Row 2: donut + funnel + appointments */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 items-stretch">
        <ChannelDonut />
        <SalesFunnel />
        <UpcomingAppointments />
      </div>

      {/* Row 3: leads + sales by branch + activity */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 items-stretch">
        <RecentLeads />
        <SalesByBranch />
        <RecentActivity />
      </div>

      {/* Quick actions */}
      <QuickActions />
    </div>
  );
}
