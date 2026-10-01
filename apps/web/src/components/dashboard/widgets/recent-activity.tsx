'use client';

import { MessageCircle, ShoppingCart, CalendarCheck, Bot, StickyNote, ArrowRight } from 'lucide-react';

const activities = [
  {
    icon: MessageCircle,
    bg: '#dcfce7',
    color: '#16a34a',
    title: 'Nueva conversación de Juan Pérez',
    subtitle: 'WhatsApp · Hace 2 minutos',
  },
  {
    icon: ShoppingCart,
    bg: '#dbeafe',
    color: '#2563eb',
    title: 'Nuevo pedido #ORD-1250',
    subtitle: 'Sucursal Centro · Hace 10 minutos',
  },
  {
    icon: CalendarCheck,
    bg: '#fce7f3',
    color: '#db2777',
    title: 'Nueva cita agendada',
    subtitle: 'María González · Hace 15 minutos',
  },
  {
    icon: Bot,
    bg: '#ede9fe',
    color: '#7c3aed',
    title: 'AI Agent resolvió conversación',
    subtitle: 'WhatsApp · Hace 20 minutos',
  },
  {
    icon: StickyNote,
    bg: '#fef3c7',
    color: '#d97706',
    title: 'Nota agregada a Carlos Ruiz',
    subtitle: 'Por Ana Martínez · Hace 30 minutos',
  },
];

export function RecentActivity() {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 h-full flex flex-col">
      <h3 className="font-semibold text-gray-900 mb-4">Actividad Reciente</h3>

      <div className="space-y-4 flex-1">
        {activities.map((a, i) => {
          const Icon = a.icon;
          return (
            <div key={i} className="flex items-start gap-3">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                style={{ backgroundColor: a.bg }}
              >
                <Icon className="w-4 h-4" style={{ color: a.color }} />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900 leading-tight">{a.title}</p>
                <p className="text-xs text-gray-500 mt-0.5">{a.subtitle}</p>
              </div>
            </div>
          );
        })}
      </div>

      <button className="mt-4 text-sm text-blue-600 font-medium hover:text-blue-700 flex items-center gap-1">
        Ver toda la actividad <ArrowRight className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
