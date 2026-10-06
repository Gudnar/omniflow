'use client';

import { ArrowRight } from 'lucide-react';
import { useRouter } from 'next/navigation';
import type { AppointmentStatus } from '@/lib/types';

const AVATAR_COLORS = ['#ec4899', '#3b82f6', '#a855f7', '#f59e0b', '#22c55e'];

function initialsOf(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');
}

interface UpcomingAppointment {
  id: string;
  contactName: string;
  serviceName: string | null;
  startAt: string;
  status: AppointmentStatus;
}

export function UpcomingAppointments({ appointments }: { appointments: UpcomingAppointment[] }) {
  const router = useRouter();

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900">Próximas Citas</h3>
      </div>

      {appointments.length === 0 ? (
        <p className="text-sm text-gray-400 py-10 text-center flex-1">Sin citas próximas.</p>
      ) : (
        <div className="space-y-4 flex-1">
          {appointments.map((a, i) => (
            <div key={a.id} className="flex items-center gap-3">
              <span className="text-xs font-semibold text-gray-500 w-16 shrink-0">
                {new Date(a.startAt).toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' })}
              </span>
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-semibold shrink-0"
                style={{ backgroundColor: AVATAR_COLORS[i % AVATAR_COLORS.length] }}
              >
                {initialsOf(a.contactName)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-900 truncate">{a.contactName}</p>
                <p className="text-xs text-gray-500 truncate">{a.serviceName ?? '—'}</p>
              </div>
              <span
                className={`text-xs font-semibold px-2.5 py-1 rounded-full shrink-0 ${
                  a.status === 'CONFIRMED' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
                }`}
              >
                {a.status === 'CONFIRMED' ? 'Confirmada' : 'Pendiente'}
              </span>
            </div>
          ))}
        </div>
      )}

      <button
        onClick={() => router.push('/dashboard/booking')}
        className="mt-4 text-sm text-blue-600 font-medium hover:text-blue-700 flex items-center gap-1"
      >
        Ver todas las citas <ArrowRight className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
