'use client';

import { ArrowRight } from 'lucide-react';

const appointments = [
  { time: '09:30 AM', name: 'María González', detail: 'Consulta dermatológica', status: 'Pendiente', initials: 'MG', color: '#ec4899' },
  { time: '11:00 AM', name: 'Carlos Rodríguez', detail: 'Asesoría nutricional', status: 'Confirmada', initials: 'CR', color: '#3b82f6' },
  { time: '01:30 PM', name: 'Ana Martínez', detail: 'Evaluación inicial', status: 'Pendiente', initials: 'AM', color: '#a855f7' },
  { time: '03:00 PM', name: 'Luis Fernández', detail: 'Seguimiento', status: 'Confirmada', initials: 'LF', color: '#f59e0b' },
  { time: '04:30 PM', name: 'Patricia López', detail: 'Consulta médica', status: 'Pendiente', initials: 'PL', color: '#22c55e' },
];

export function UpcomingAppointments() {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900">Próximas Citas</h3>
        <button className="text-sm text-blue-600 font-medium hover:text-blue-700">Ver calendario</button>
      </div>

      <div className="space-y-4 flex-1">
        {appointments.map((a, i) => (
          <div key={i} className="flex items-center gap-3">
            <span className="text-xs font-semibold text-gray-500 w-16 shrink-0">{a.time}</span>
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-semibold shrink-0"
              style={{ backgroundColor: a.color }}
            >
              {a.initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-gray-900 truncate">{a.name}</p>
              <p className="text-xs text-gray-500 truncate">{a.detail}</p>
            </div>
            <span
              className={`text-xs font-semibold px-2.5 py-1 rounded-full shrink-0 ${
                a.status === 'Confirmada'
                  ? 'bg-emerald-50 text-emerald-600'
                  : 'bg-amber-50 text-amber-600'
              }`}
            >
              {a.status}
            </span>
          </div>
        ))}
      </div>

      <button className="mt-4 text-sm text-blue-600 font-medium hover:text-blue-700 flex items-center gap-1">
        Ver todas las citas <ArrowRight className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
