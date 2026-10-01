'use client';

import { useEffect, useState } from 'react';
import { Plus, Trash2, CalendarOff } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/lib/toast-context';
import { apiGet, apiPatch, apiPost, apiDelete } from '@/lib/api-client';
import type { BookingBlackoutDate } from '@/lib/types';

interface Branch {
  id: string;
  name: string;
  minBookingLeadDays: number;
}

export function AvailabilityTab() {
  const { tokens } = useAuth();
  const toast = useToast();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState('');
  const [leadDays, setLeadDays] = useState(1);
  const [blackoutDates, setBlackoutDates] = useState<BookingBlackoutDate[]>([]);
  const [newDate, setNewDate] = useState('');
  const [newReason, setNewReason] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tokens) return;
    apiGet<Branch[]>('/branches', tokens.accessToken)
      .then((data) => {
        setBranches(data);
        if (data.length) setSelectedBranchId(data[0].id);
      })
      .catch((err) => console.error('Error fetching branches:', err))
      .finally(() => setLoading(false));
  }, [tokens]);

  const refetchBlackoutDates = (branchId: string) =>
    apiGet<BookingBlackoutDate[]>(`/booking/blackout-dates?branchId=${branchId}`, tokens?.accessToken).then(setBlackoutDates);

  useEffect(() => {
    const branch = branches.find((b) => b.id === selectedBranchId);
    if (branch) setLeadDays(branch.minBookingLeadDays);
    if (selectedBranchId) {
      refetchBlackoutDates(selectedBranchId).catch((err) => console.error('Error fetching blackout dates:', err));
    }
  }, [selectedBranchId, branches]);

  const saveLeadDays = async () => {
    try {
      await apiPatch(`/branches/${selectedBranchId}`, tokens?.accessToken, { minBookingLeadDays: leadDays });
      setBranches((prev) => prev.map((b) => (b.id === selectedBranchId ? { ...b, minBookingLeadDays: leadDays } : b)));
      toast.success('Anticipación mínima guardada correctamente');
    } catch (err: any) {
      toast.error(err.message ?? 'No se pudo guardar la anticipación mínima');
    }
  };

  const addBlackoutDate = async () => {
    if (!newDate) return;
    try {
      await apiPost('/booking/blackout-dates', tokens?.accessToken, {
        branchId: selectedBranchId,
        date: newDate,
        reason: newReason || undefined,
      });
      setNewDate('');
      setNewReason('');
      await refetchBlackoutDates(selectedBranchId);
      toast.success('Día bloqueado agregado correctamente');
    } catch (err: any) {
      toast.error(err.message ?? 'No se pudo agregar el día bloqueado');
    }
  };

  const removeBlackoutDate = async (id: string) => {
    try {
      await apiDelete(`/booking/blackout-dates/${id}`, tokens?.accessToken);
      await refetchBlackoutDates(selectedBranchId);
      toast.success('Día bloqueado eliminado correctamente');
    } catch (err: any) {
      toast.error(err.message ?? 'No se pudo eliminar el día bloqueado');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[30vh]">
        <div className="animate-spin w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <label className="block text-xs font-semibold text-gray-600 mb-1.5">Sucursal</label>
        <select
          value={selectedBranchId}
          onChange={(e) => setSelectedBranchId(e.target.value)}
          className="w-full sm:w-64 px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white"
        >
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
        {branches.length === 0 && <p className="text-sm text-gray-400 mt-2">Sin sucursales todavía.</p>}
      </div>

      {selectedBranchId && (
        <>
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-base font-bold text-gray-900 mb-1">Anticipación mínima para reservas públicas</h3>
            <p className="text-sm text-gray-500 mb-4">
              Un cliente que reserva desde el enlace público no podrá elegir un horario antes de esta cantidad de días.
              No aplica cuando un operador agenda manualmente desde el panel.
            </p>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min={0}
                value={leadDays}
                onChange={(e) => setLeadDays(Number(e.target.value))}
                className="w-24 px-3 py-2 border border-gray-200 rounded-lg text-sm"
              />
              <span className="text-sm text-gray-500">día(s)</span>
              <button
                onClick={saveLeadDays}
                className="ml-auto px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-semibold text-white transition"
              >
                Guardar
              </button>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-base font-bold text-gray-900 mb-1">Días sin atención</h3>
            <p className="text-sm text-gray-500 mb-4">
              En estas fechas, ningún especialista, técnico o recurso de esta sucursal aparecerá disponible para reservar.
            </p>

            <div className="flex flex-wrap items-center gap-2 mb-4 pb-4 border-b border-gray-100">
              <input
                type="date"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
              />
              <input
                value={newReason}
                onChange={(e) => setNewReason(e.target.value)}
                placeholder="Motivo (opcional)"
                className="flex-1 min-w-[160px] px-3 py-2 border border-gray-200 rounded-lg text-sm"
              />
              <button
                onClick={addBlackoutDate}
                disabled={!newDate}
                className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-semibold text-white transition disabled:opacity-50"
              >
                <Plus className="w-4 h-4" /> Agregar
              </button>
            </div>

            <div className="space-y-2">
              {blackoutDates.map((d) => (
                <div key={d.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                  <div className="flex items-center gap-2">
                    <CalendarOff className="w-4 h-4 text-gray-400" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {new Date(d.date).toLocaleDateString('es-BO', { timeZone: 'UTC', dateStyle: 'long' })}
                      </p>
                      {d.reason && <p className="text-xs text-gray-400">{d.reason}</p>}
                    </div>
                  </div>
                  <button onClick={() => removeBlackoutDate(d.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-500">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
              {blackoutDates.length === 0 && <p className="text-sm text-gray-400 text-center py-6">Sin días bloqueados.</p>}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
