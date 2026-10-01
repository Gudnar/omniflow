'use client';

import { useEffect, useState } from 'react';
import { X, Clock } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/lib/toast-context';
import { apiGet, apiPost } from '@/lib/api-client';
import type { Appointment, AppointmentStatus, AppointmentStatusHistoryEntry } from '@/lib/types';

const STATUS_LABELS: Record<AppointmentStatus, string> = {
  PENDING: 'Pendiente',
  CONFIRMED: 'Confirmada',
  COMPLETED: 'Completada',
  CANCELLED: 'Cancelada',
  NO_SHOW: 'No asistió',
};

const STATUS_COLORS: Record<AppointmentStatus, string> = {
  PENDING: 'bg-amber-50 text-amber-700',
  CONFIRMED: 'bg-blue-50 text-blue-700',
  COMPLETED: 'bg-emerald-50 text-emerald-700',
  CANCELLED: 'bg-gray-100 text-gray-500',
  NO_SHOW: 'bg-red-50 text-red-600',
};

// Mirrors the backend's transition graph (apps/api/.../appointments.service.ts).
const NEXT_STEPS: Record<AppointmentStatus, AppointmentStatus[]> = {
  PENDING: ['CONFIRMED'],
  CONFIRMED: ['COMPLETED', 'NO_SHOW'],
  COMPLETED: [],
  CANCELLED: [],
  NO_SHOW: [],
};

export function AppointmentDetailPanel({
  appointmentId,
  onClose,
  onChanged,
}: {
  appointmentId: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { tokens } = useAuth();
  const toast = useToast();
  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [history, setHistory] = useState<AppointmentStatusHistoryEntry[]>([]);
  const [busy, setBusy] = useState(false);

  const refetch = async () => {
    const [apptData, historyData] = await Promise.all([
      apiGet<Appointment>(`/appointments/${appointmentId}`, tokens?.accessToken),
      apiGet<AppointmentStatusHistoryEntry[]>(`/appointments/${appointmentId}/status-history`, tokens?.accessToken),
    ]);
    setAppointment(apptData);
    setHistory(historyData);
  };

  useEffect(() => {
    refetch().catch((err) => console.error('Error fetching appointment:', err));
  }, [appointmentId, tokens]);

  const advance = async (status: AppointmentStatus) => {
    setBusy(true);
    try {
      await apiPost(`/appointments/${appointmentId}/status`, tokens?.accessToken, { status });
      await refetch();
      onChanged();
      toast.success('Estado de la cita actualizado correctamente');
    } catch (err: any) {
      toast.error(err.message ?? 'Error al cambiar el estado');
    } finally {
      setBusy(false);
    }
  };

  const cancel = async () => {
    if (!confirm('¿Cancelar esta cita?')) return;
    setBusy(true);
    try {
      await apiPost(`/appointments/${appointmentId}/cancel`, tokens?.accessToken, {});
      await refetch();
      onChanged();
      toast.success('Cita cancelada correctamente');
    } catch (err: any) {
      toast.error(err.message ?? 'Error al cancelar la cita');
    } finally {
      setBusy(false);
    }
  };

  if (!appointment) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-8 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full" />
      </div>
    );
  }

  const nextSteps = NEXT_STEPS[appointment.status];
  const canCancel = appointment.status === 'PENDING' || appointment.status === 'CONFIRMED';
  const isPending = appointment.status === 'PENDING';

  return (
    <div className="bg-white rounded-xl border border-gray-200 flex flex-col overflow-hidden max-h-[calc(100vh-8rem)]">
      <div className="flex items-center justify-between p-5 border-b border-gray-100">
        <div>
          <p className="text-base font-bold text-gray-900">{appointment.contact.name}</p>
          <p className="text-xs text-gray-400">{new Date(appointment.startAt).toLocaleString()}</p>
        </div>
        <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 text-gray-400 transition shrink-0">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-6">
        <div className="flex items-center justify-between">
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${STATUS_COLORS[appointment.status]}`}>
            {STATUS_LABELS[appointment.status]}
          </span>
          <p className="text-lg font-bold text-gray-900">
            {appointment.currency} {appointment.total.toFixed(2)}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {nextSteps.map((step) => (
            <button
              key={step}
              onClick={() => advance(step)}
              disabled={busy}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm font-semibold"
            >
              {isPending && step === 'CONFIRMED' ? 'Aprobar cita' : `Marcar como ${STATUS_LABELS[step].toLowerCase()}`}
            </button>
          ))}
          {canCancel && (
            <button
              onClick={cancel}
              disabled={busy}
              className="px-4 py-2 border border-gray-300 disabled:opacity-50 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              {isPending ? 'Rechazar cita' : 'Cancelar cita'}
            </button>
          )}
        </div>

        <div>
          <h4 className="text-sm font-bold text-gray-900 mb-3">Servicios</h4>
          <div className="space-y-2">
            {appointment.services.map((s) => (
              <div key={s.id} className="flex items-center justify-between text-sm border-b border-gray-50 pb-2">
                <div>
                  <p className="font-medium text-gray-900">{s.serviceNameSnapshot}</p>
                  <p className="text-xs text-gray-400">{s.durationMinutesSnapshot} min</p>
                </div>
                <p className="font-semibold text-gray-900">
                  {appointment.currency} {s.priceSnapshot.toFixed(2)}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h4 className="text-sm font-bold text-gray-900 mb-3">Recursos asignados</h4>
          <div className="flex flex-wrap gap-2">
            {appointment.resources.map((r) => (
              <span key={r.resourceId} className="text-xs font-medium px-2.5 py-1 rounded-full bg-gray-100 text-gray-700">
                {r.resource.name}
              </span>
            ))}
          </div>
        </div>

        <div>
          <h4 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
            <Clock className="w-4 h-4 text-gray-400" /> Historial de estado
          </h4>
          <div className="space-y-3">
            {history.map((entry) => (
              <div key={entry.id} className="flex items-start justify-between text-sm">
                <div>
                  <p className="text-gray-900 font-medium">
                    {entry.fromStatus ? `${STATUS_LABELS[entry.fromStatus]} → ` : ''}
                    {STATUS_LABELS[entry.toStatus]}
                  </p>
                  {entry.note && <p className="text-xs text-gray-500">{entry.note}</p>}
                </div>
                <p className="text-xs text-gray-400 shrink-0">{new Date(entry.createdAt).toLocaleString()}</p>
              </div>
            ))}
            {history.length === 0 && <p className="text-sm text-gray-400">Sin cambios de estado todavía.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
