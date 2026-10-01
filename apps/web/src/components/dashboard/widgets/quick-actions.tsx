'use client';

import { UserPlus, Send, FileText, Share2, CalendarPlus, Tag, BarChart3 } from 'lucide-react';

const actions = [
  { icon: UserPlus, label: 'Nuevo Lead', bg: '#dcfce7', color: '#16a34a' },
  { icon: Send, label: 'Nueva Campaña', bg: '#fee2e2', color: '#dc2626' },
  { icon: FileText, label: 'Crear Plantilla', bg: '#ede9fe', color: '#7c3aed' },
  { icon: Share2, label: 'Crear Flow', bg: '#dbeafe', color: '#2563eb' },
  { icon: CalendarPlus, label: 'Nueva Cita', bg: '#dcfce7', color: '#16a34a' },
  { icon: Tag, label: 'Nuevo Producto', bg: '#fce7f3', color: '#db2777' },
  { icon: BarChart3, label: 'Ver Reportes', bg: '#e0e7ff', color: '#4f46e5' },
];

export function QuickActions() {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <h3 className="font-semibold text-gray-900 mb-4">Acciones Rápidas</h3>
      <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(150px,1fr))]">
        {actions.map((a) => {
          const Icon = a.icon;
          return (
            <button
              key={a.label}
              className="flex items-center gap-2 px-3 py-3 rounded-lg border border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition text-left"
            >
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                style={{ backgroundColor: a.bg }}
              >
                <Icon className="w-4 h-4" style={{ color: a.color }} />
              </div>
              <span className="text-sm font-medium text-gray-700 leading-tight">{a.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
