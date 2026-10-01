'use client';

import { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/lib/toast-context';
import { apiGet, apiPost, apiPatch, apiDelete } from '@/lib/api-client';
import type { BookingResource, BookingResourceType, BookingService, UserSchedule, UserTimeOff } from '@/lib/types';
import { Modal } from '@/components/ui/modal';

const DAY_LABELS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const TYPE_LABELS: Record<BookingResourceType, string> = { STAFF: 'Especialista', ROOM: 'Sala', EQUIPMENT: 'Equipo', OTHER: 'Otro' };

function minutesToTime(m: number) {
  const h = Math.floor(m / 60)
    .toString()
    .padStart(2, '0');
  const min = (m % 60).toString().padStart(2, '0');
  return `${h}:${min}`;
}

function timeToMinutes(t: string) {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

interface Branch {
  id: string;
  name: string;
}

const EMPTY_FORM = { branchId: '', name: '', type: 'STAFF' as BookingResourceType, userId: '' };

export function ResourcesTab() {
  const { tokens } = useAuth();
  const toast = useToast();
  const [resources, setResources] = useState<BookingResource[]>([]);
  const [services, setServices] = useState<BookingService[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const refetch = () => apiGet<BookingResource[]>('/booking/resources', tokens?.accessToken).then(setResources);

  useEffect(() => {
    if (!tokens) return;
    Promise.all([
      refetch(),
      apiGet<BookingService[]>('/booking/services', tokens.accessToken).then(setServices),
      apiGet<Branch[]>('/branches', tokens.accessToken).then(setBranches),
    ])
      .catch((err) => console.error('Error fetching resources:', err))
      .finally(() => setLoading(false));
  }, [tokens]);

  const create = async () => {
    try {
      await apiPost('/booking/resources', tokens?.accessToken, {
        ...form,
        userId: form.type === 'STAFF' ? form.userId || undefined : undefined,
      });
      await refetch();
      setShowModal(false);
      setForm(EMPTY_FORM);
      toast.success('Recurso creado correctamente');
    } catch (err: any) {
      toast.error(err.message ?? 'No se pudo crear el recurso');
    }
  };

  const remove = async (id: string) => {
    if (!confirm('¿Eliminar este recurso?')) return;
    try {
      await apiDelete(`/booking/resources/${id}`, tokens?.accessToken);
      if (selectedId === id) setSelectedId(null);
      await refetch();
      toast.success('Recurso eliminado correctamente');
    } catch (err: any) {
      toast.error(err.message ?? 'No se pudo eliminar el recurso');
    }
  };

  const selected = resources.find((r) => r.id === selectedId) ?? null;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[30vh]">
        <div className="animate-spin w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-1.5 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-semibold text-white transition"
        >
          <Plus className="w-4 h-4" />
          Nuevo recurso
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[380px_1fr] gap-4 items-start">
        <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-50">
          {resources.map((r) => (
            <button
              key={r.id}
              onClick={() => setSelectedId(r.id)}
              className={`w-full flex items-center justify-between p-4 text-left transition ${
                selectedId === r.id ? 'bg-blue-50' : 'hover:bg-gray-50'
              }`}
            >
              <div>
                <p className="text-sm font-semibold text-gray-900">{r.name}</p>
                <p className="text-xs text-gray-400">{TYPE_LABELS[r.type]} · {r.branch.name}</p>
              </div>
              <span
                className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                  r.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'
                }`}
              >
                {r.status === 'ACTIVE' ? 'Activo' : 'Inactivo'}
              </span>
            </button>
          ))}
          {resources.length === 0 && <p className="p-4 text-sm text-gray-400 text-center">Sin recursos todavía.</p>}
        </div>

        {selected && (
          <ResourceDetailPanel
            resource={selected}
            services={services}
            onChanged={refetch}
            onDelete={() => remove(selected.id)}
          />
        )}
      </div>

      <Modal open={showModal} onClose={() => setShowModal(false)} title="Nuevo recurso">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1.5">Nombre</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-1.5">Sucursal</label>
              <select value={form.branchId} onChange={(e) => setForm({ ...form, branchId: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white">
                <option value="">—</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-1.5">Tipo</label>
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as BookingResourceType })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white">
                <option value="STAFF">Especialista</option>
                <option value="ROOM">Sala</option>
                <option value="EQUIPMENT">Equipo</option>
                <option value="OTHER">Otro</option>
              </select>
            </div>
          </div>
          {form.type === 'STAFF' && (
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-1.5">ID de usuario (staff)</label>
              <input value={form.userId} onChange={(e) => setForm({ ...form, userId: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            </div>
          )}
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={() => setShowModal(false)} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-900 hover:bg-gray-50 font-medium text-sm">
            Cancelar
          </button>
          <button onClick={create} className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold text-sm">
            Crear
          </button>
        </div>
      </Modal>
    </div>
  );
}

function ResourceDetailPanel({
  resource,
  services,
  onChanged,
  onDelete,
}: {
  resource: BookingResource;
  services: BookingService[];
  onChanged: () => void;
  onDelete: () => void;
}) {
  const { tokens } = useAuth();
  const toast = useToast();
  const [scheduleForm, setScheduleForm] = useState({ dayOfWeek: 1, startTime: '09:00', endTime: '18:00' });
  const [userSchedule, setUserSchedule] = useState<UserSchedule | null>(null);
  const [timeOff, setTimeOff] = useState<UserTimeOff[] | null>(null);
  const [userScheduleForm, setUserScheduleForm] = useState({ dayOfWeek: 1, startTime: '09:00', endTime: '13:00' });
  const [timeOffForm, setTimeOffForm] = useState({ startAt: '', endAt: '', reason: '' });

  useEffect(() => {
    if (resource.type !== 'STAFF' || !resource.userId) {
      setUserSchedule(null);
      setTimeOff(null);
      return;
    }
    apiGet<UserSchedule>(`/users/${resource.userId}/schedule`, tokens?.accessToken).then(setUserSchedule);
    apiGet<UserTimeOff[]>(`/users/${resource.userId}/time-off`, tokens?.accessToken).then(setTimeOff);
  }, [resource.id, resource.type, resource.userId, tokens]);

  const toggleService = async (serviceId: string, currentlyAssigned: boolean) => {
    try {
      if (currentlyAssigned) {
        await apiDelete(`/booking/resources/${resource.id}/services/${serviceId}`, tokens?.accessToken);
      } else {
        await apiPost(`/booking/resources/${resource.id}/services/${serviceId}`, tokens?.accessToken, {});
      }
      onChanged();
      toast.success(currentlyAssigned ? 'Servicio desasignado correctamente' : 'Servicio asignado correctamente');
    } catch (err: any) {
      toast.error(err.message ?? 'Error al asignar servicio');
    }
  };

  const addScheduleEntry = async () => {
    try {
      await apiPost(`/booking/resources/${resource.id}/schedule`, tokens?.accessToken, {
        dayOfWeek: scheduleForm.dayOfWeek,
        startMinute: timeToMinutes(scheduleForm.startTime),
        endMinute: timeToMinutes(scheduleForm.endTime),
      });
      onChanged();
      toast.success('Horario agregado correctamente');
    } catch (err: any) {
      toast.error(err.message ?? 'No se pudo agregar el horario');
    }
  };

  const removeScheduleEntry = async (entryId: string) => {
    try {
      await apiDelete(`/booking/resources/${resource.id}/schedule/${entryId}`, tokens?.accessToken);
      onChanged();
      toast.success('Horario eliminado correctamente');
    } catch (err: any) {
      toast.error(err.message ?? 'No se pudo eliminar el horario');
    }
  };

  const addUserScheduleInterval = async () => {
    if (!resource.userId || !userSchedule) return;
    const newIntervals = [
      ...userSchedule.intervals.map((i) => ({ dayOfWeek: i.dayOfWeek, startMinute: i.startMinute, endMinute: i.endMinute })),
      {
        dayOfWeek: userScheduleForm.dayOfWeek,
        startMinute: timeToMinutes(userScheduleForm.startTime),
        endMinute: timeToMinutes(userScheduleForm.endTime),
      },
    ];
    try {
      const updated = await apiPatch<UserSchedule>(`/users/${resource.userId}/schedule`, tokens?.accessToken, { intervals: newIntervals });
      setUserSchedule(updated);
      toast.success('Horario agregado correctamente');
    } catch (err: any) {
      toast.error(err.message ?? 'No se pudo actualizar el horario');
    }
  };

  const removeUserScheduleInterval = async (intervalId: string) => {
    if (!resource.userId || !userSchedule) return;
    const newIntervals = userSchedule.intervals
      .filter((i) => i.id !== intervalId)
      .map((i) => ({ dayOfWeek: i.dayOfWeek, startMinute: i.startMinute, endMinute: i.endMinute }));
    try {
      const updated = await apiPatch<UserSchedule>(`/users/${resource.userId}/schedule`, tokens?.accessToken, { intervals: newIntervals });
      setUserSchedule(updated);
      toast.success('Horario eliminado correctamente');
    } catch (err: any) {
      toast.error(err.message ?? 'No se pudo actualizar el horario');
    }
  };

  const addTimeOff = async () => {
    if (!resource.userId || !timeOffForm.startAt || !timeOffForm.endAt) return;
    try {
      const created = await apiPost<UserTimeOff>(`/users/${resource.userId}/time-off`, tokens?.accessToken, timeOffForm);
      setTimeOff((prev) => [created, ...(prev ?? [])]);
      setTimeOffForm({ startAt: '', endAt: '', reason: '' });
      toast.success('Ausencia registrada correctamente');
    } catch (err: any) {
      toast.error(err.message ?? 'No se pudo registrar la ausencia');
    }
  };

  const removeTimeOff = async (id: string) => {
    if (!resource.userId) return;
    try {
      await apiDelete(`/users/${resource.userId}/time-off/${id}`, tokens?.accessToken);
      setTimeOff((prev) => (prev ?? []).filter((t) => t.id !== id));
      toast.success('Ausencia eliminada correctamente');
    } catch (err: any) {
      toast.error(err.message ?? 'No se pudo eliminar la ausencia');
    }
  };

  const assignedServiceIds = new Set(resource.services.map((s) => s.serviceId));

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-base font-bold text-gray-900">{resource.name}</p>
          <p className="text-xs text-gray-400">{TYPE_LABELS[resource.type]} · {resource.branch.name}</p>
        </div>
        <button onClick={onDelete} className="px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg">
          Eliminar
        </button>
      </div>

      <div>
        <h4 className="text-sm font-bold text-gray-900 mb-3">Servicios ofrecidos</h4>
        <div className="flex flex-wrap gap-2">
          {services.map((s) => {
            const assigned = assignedServiceIds.has(s.id);
            return (
              <button
                key={s.id}
                onClick={() => toggleService(s.id, assigned)}
                className={`text-xs font-medium px-2.5 py-1.5 rounded-full border transition ${
                  assigned ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600'
                }`}
              >
                {s.name}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <h4 className="text-sm font-bold text-gray-900 mb-3">Horario del recurso</h4>
        <div className="space-y-1.5 mb-3">
          {resource.schedule.map((entry) => (
            <div key={entry.id} className="flex items-center justify-between text-sm bg-gray-50 rounded-lg px-3 py-2">
              <span>{DAY_LABELS[entry.dayOfWeek]} · {minutesToTime(entry.startMinute)} - {minutesToTime(entry.endMinute)}</span>
              <button onClick={() => removeScheduleEntry(entry.id)} className="text-red-500 hover:text-red-600">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
          {resource.schedule.length === 0 && <p className="text-xs text-gray-400">Sin horario configurado.</p>}
        </div>
        <div className="flex items-center gap-2">
          <select value={scheduleForm.dayOfWeek} onChange={(e) => setScheduleForm({ ...scheduleForm, dayOfWeek: Number(e.target.value) })} className="px-2 py-1.5 border border-gray-200 rounded-lg text-xs bg-white">
            {DAY_LABELS.map((d, i) => (
              <option key={i} value={i}>{d}</option>
            ))}
          </select>
          <input type="time" value={scheduleForm.startTime} onChange={(e) => setScheduleForm({ ...scheduleForm, startTime: e.target.value })} className="px-2 py-1.5 border border-gray-200 rounded-lg text-xs" />
          <input type="time" value={scheduleForm.endTime} onChange={(e) => setScheduleForm({ ...scheduleForm, endTime: e.target.value })} className="px-2 py-1.5 border border-gray-200 rounded-lg text-xs" />
          <button onClick={addScheduleEntry} className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shrink-0">
            Agregar
          </button>
        </div>
      </div>

      {resource.type === 'STAFF' && resource.userId && (
        <>
          <div>
            <h4 className="text-sm font-bold text-gray-900 mb-1">Horario personal del especialista</h4>
            <p className="text-xs text-gray-400 mb-3">
              La disponibilidad real es la intersección entre el horario del recurso y este horario personal.
            </p>
            <div className="space-y-1.5 mb-3">
              {(userSchedule?.intervals ?? []).map((entry) => (
                <div key={entry.id} className="flex items-center justify-between text-sm bg-gray-50 rounded-lg px-3 py-2">
                  <span>{DAY_LABELS[entry.dayOfWeek]} · {minutesToTime(entry.startMinute)} - {minutesToTime(entry.endMinute)}</span>
                  <button onClick={() => removeUserScheduleInterval(entry.id)} className="text-red-500 hover:text-red-600">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
              {userSchedule && userSchedule.intervals.length === 0 && <p className="text-xs text-gray-400">Sin horario personal configurado.</p>}
            </div>
            <div className="flex items-center gap-2">
              <select value={userScheduleForm.dayOfWeek} onChange={(e) => setUserScheduleForm({ ...userScheduleForm, dayOfWeek: Number(e.target.value) })} className="px-2 py-1.5 border border-gray-200 rounded-lg text-xs bg-white">
                {DAY_LABELS.map((d, i) => (
                  <option key={i} value={i}>{d}</option>
                ))}
              </select>
              <input type="time" value={userScheduleForm.startTime} onChange={(e) => setUserScheduleForm({ ...userScheduleForm, startTime: e.target.value })} className="px-2 py-1.5 border border-gray-200 rounded-lg text-xs" />
              <input type="time" value={userScheduleForm.endTime} onChange={(e) => setUserScheduleForm({ ...userScheduleForm, endTime: e.target.value })} className="px-2 py-1.5 border border-gray-200 rounded-lg text-xs" />
              <button onClick={addUserScheduleInterval} className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shrink-0">
                Agregar
              </button>
            </div>
          </div>

          <div>
            <h4 className="text-sm font-bold text-gray-900 mb-3">Ausencias / vacaciones</h4>
            <div className="space-y-1.5 mb-3">
              {(timeOff ?? []).map((t) => (
                <div key={t.id} className="flex items-center justify-between text-sm bg-gray-50 rounded-lg px-3 py-2">
                  <span>
                    {new Date(t.startAt).toLocaleString()} → {new Date(t.endAt).toLocaleString()}
                    {t.reason ? ` · ${t.reason}` : ''}
                  </span>
                  <button onClick={() => removeTimeOff(t.id)} className="text-red-500 hover:text-red-600">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
              {timeOff && timeOff.length === 0 && <p className="text-xs text-gray-400">Sin ausencias registradas.</p>}
            </div>
            <div className="flex items-center gap-2">
              <input type="datetime-local" value={timeOffForm.startAt} onChange={(e) => setTimeOffForm({ ...timeOffForm, startAt: e.target.value })} className="px-2 py-1.5 border border-gray-200 rounded-lg text-xs" />
              <input type="datetime-local" value={timeOffForm.endAt} onChange={(e) => setTimeOffForm({ ...timeOffForm, endAt: e.target.value })} className="px-2 py-1.5 border border-gray-200 rounded-lg text-xs" />
              <input value={timeOffForm.reason} onChange={(e) => setTimeOffForm({ ...timeOffForm, reason: e.target.value })} placeholder="Motivo" className="flex-1 px-2 py-1.5 border border-gray-200 rounded-lg text-xs" />
              <button onClick={addTimeOff} className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shrink-0">
                Agregar
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
