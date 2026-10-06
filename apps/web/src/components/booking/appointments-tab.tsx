'use client';

import { useEffect, useMemo, useState } from 'react';
import { Plus, List, CalendarRange, CalendarDays } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/lib/toast-context';
import { apiGet, apiPost } from '@/lib/api-client';
import type { Appointment, AppointmentStatus, BookingService, AvailabilitySlot } from '@/lib/types';
import { Modal } from '@/components/ui/modal';
import { AppointmentDetailPanel } from './appointment-detail-panel';
import { CalendarView } from './calendar-view';
import { formatZonedDateTime, formatZonedTime } from './timezone';

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

const STATUS_CHIP_ACTIVE: Record<AppointmentStatus, string> = {
  PENDING: 'bg-amber-500 text-white border-amber-500',
  CONFIRMED: 'bg-blue-600 text-white border-blue-600',
  COMPLETED: 'bg-emerald-600 text-white border-emerald-600',
  CANCELLED: 'bg-gray-500 text-white border-gray-500',
  NO_SHOW: 'bg-red-500 text-white border-red-500',
};

const ALL_STATUSES: AppointmentStatus[] = ['PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'NO_SHOW'];

type ViewMode = 'list' | 'week' | 'day';

interface Branch {
  id: string;
  name: string;
  timezone: string;
}
interface ContactOption {
  id: string;
  name: string;
}

export function AppointmentsTab() {
  const { tokens } = useAuth();
  const toast = useToast();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [services, setServices] = useState<BookingService[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [contacts, setContacts] = useState<ContactOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);

  const [viewMode, setViewMode] = useState<ViewMode>('week');
  const [filterBranchId, setFilterBranchId] = useState('');
  const [filterServiceId, setFilterServiceId] = useState('');
  const [filterStatuses, setFilterStatuses] = useState<AppointmentStatus[]>([]);

  const [form, setForm] = useState({ contactId: '', branchId: '', serviceId: '', date: '' });
  const [slots, setSlots] = useState<AvailabilitySlot[] | null>(null);

  const refetch = () => apiGet<Appointment[]>('/appointments', tokens?.accessToken).then(setAppointments);

  useEffect(() => {
    if (!tokens) return;
    Promise.all([
      refetch(),
      apiGet<BookingService[]>('/booking/services', tokens.accessToken).then(setServices),
      apiGet<Branch[]>('/branches', tokens.accessToken).then(setBranches),
      apiGet<ContactOption[]>('/contacts', tokens.accessToken).then(setContacts),
    ])
      .catch((err) => console.error('Error fetching appointments:', err))
      .finally(() => setLoading(false));
  }, [tokens]);

  const toggleStatus = (status: AppointmentStatus) => {
    setFilterStatuses((prev) => (prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status]));
  };

  const filteredAppointments = useMemo(() => {
    return appointments.filter((a) => {
      if (filterBranchId && a.branchId !== filterBranchId) return false;
      if (filterServiceId && !a.services.some((s) => s.serviceId === filterServiceId)) return false;
      if (filterStatuses.length > 0 && !filterStatuses.includes(a.status)) return false;
      return true;
    });
  }, [appointments, filterBranchId, filterServiceId, filterStatuses]);

  const openCreate = () => {
    setForm({ contactId: '', branchId: '', serviceId: '', date: '' });
    setSlots(null);
    setShowModal(true);
  };

  const searchAvailability = async () => {
    if (!form.serviceId || !form.branchId || !form.date) return;
    try {
      const result = await apiGet<AvailabilitySlot[]>(
        `/booking/availability?serviceId=${form.serviceId}&branchId=${form.branchId}&date=${form.date}`,
        tokens?.accessToken,
      );
      setSlots(result);
    } catch (err) {
      console.error('Error fetching availability:', err);
    }
  };

  const bookSlot = async (slot: AvailabilitySlot) => {
    try {
      await apiPost('/appointments', tokens?.accessToken, {
        contactId: form.contactId,
        branchId: form.branchId,
        serviceIds: [form.serviceId],
        startAt: slot.startAt,
      });
      await refetch();
      setShowModal(false);
      toast.success('Cita reservada correctamente');
    } catch (err: any) {
      toast.error(err.message ?? 'Error al reservar la cita');
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
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
          <ViewToggleButton icon={CalendarRange} label="Semana" active={viewMode === 'week'} onClick={() => setViewMode('week')} />
          <ViewToggleButton icon={CalendarDays} label="Día" active={viewMode === 'day'} onClick={() => setViewMode('day')} />
          <ViewToggleButton icon={List} label="Lista" active={viewMode === 'list'} onClick={() => setViewMode('list')} />
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-1.5 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-semibold text-white transition"
        >
          <Plus className="w-4 h-4" />
          Nueva cita
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-gray-500">Sucursal</label>
          <select
            value={filterBranchId}
            onChange={(e) => setFilterBranchId(e.target.value)}
            className="px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm bg-white"
          >
            <option value="">Todas</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-gray-500">Servicio</label>
          <select
            value={filterServiceId}
            onChange={(e) => setFilterServiceId(e.target.value)}
            className="px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm bg-white"
          >
            <option value="">Todos</option>
            {services.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          <label className="text-xs font-semibold text-gray-500 mr-0.5">Estado</label>
          {ALL_STATUSES.map((status) => {
            const active = filterStatuses.includes(status);
            return (
              <button
                key={status}
                onClick={() => toggleStatus(status)}
                className={`px-2.5 py-1 rounded-full text-xs font-semibold border transition ${
                  active ? STATUS_CHIP_ACTIVE[status] : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
                }`}
              >
                {STATUS_LABELS[status]}
              </button>
            );
          })}
          {filterStatuses.length > 0 && (
            <button onClick={() => setFilterStatuses([])} className="text-xs text-gray-400 hover:text-gray-600 ml-1">
              Limpiar
            </button>
          )}
        </div>
      </div>

      {viewMode === 'list' ? (
        <div className="bg-white rounded-xl border border-gray-200">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs font-semibold text-gray-500">
                <th className="px-4 py-3">Contacto</th>
                <th className="px-3 py-3">Servicios</th>
                <th className="px-3 py-3">Sucursal</th>
                <th className="px-3 py-3">Fecha/hora</th>
                <th className="px-3 py-3">Total</th>
                <th className="px-3 py-3">Estado</th>
              </tr>
            </thead>
            <tbody>
              {filteredAppointments.map((a) => (
                <tr
                  key={a.id}
                  onClick={() => setSelectedId(a.id)}
                  className="border-b border-gray-50 cursor-pointer transition hover:bg-gray-50"
                >
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {a.contact.name}
                    {a.patientName && <span className="block text-xs font-normal text-gray-400">Para {a.patientName}</span>}
                  </td>
                  <td className="px-3 py-3 text-gray-600">{a.services.map((s) => s.serviceNameSnapshot).join(', ')}</td>
                  <td className="px-3 py-3 text-gray-600">{a.branch.name}</td>
                  <td className="px-3 py-3 text-gray-600 whitespace-nowrap">{formatZonedDateTime(a.startAt, a.branch.timezone)}</td>
                  <td className="px-3 py-3 font-medium text-gray-900">{a.currency} {a.total.toFixed(2)}</td>
                  <td className="px-3 py-3">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_COLORS[a.status]}`}>
                      {STATUS_LABELS[a.status]}
                    </span>
                  </td>
                </tr>
              ))}
              {filteredAppointments.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-400">
                    Sin citas que coincidan con los filtros.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <CalendarView mode={viewMode} appointments={filteredAppointments} onSelect={setSelectedId} />
      )}

      <Modal open={selectedId !== null} onClose={() => setSelectedId(null)} size="lg">
        {selectedId && (
          <AppointmentDetailPanel
            appointmentId={selectedId}
            onClose={() => setSelectedId(null)}
            onChanged={refetch}
            onSelectAppointment={setSelectedId}
          />
        )}
      </Modal>

      <Modal open={showModal} onClose={() => setShowModal(false)} title="Nueva cita">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1.5">Contacto</label>
            <select value={form.contactId} onChange={(e) => setForm({ ...form, contactId: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white">
              <option value="">—</option>
              {contacts.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
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
              <label className="block text-sm font-medium text-gray-900 mb-1.5">Servicio</label>
              <select value={form.serviceId} onChange={(e) => setForm({ ...form, serviceId: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white">
                <option value="">—</option>
                {services.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1.5">Fecha</label>
            <div className="flex items-center gap-2">
              <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm" />
              <button
                onClick={searchAvailability}
                disabled={!form.contactId || !form.branchId || !form.serviceId || !form.date}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm font-semibold shrink-0"
              >
                Buscar horarios
              </button>
            </div>
          </div>

          {slots !== null && (
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-1.5">Horarios disponibles</label>
              <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto">
                {slots.map((slot) => (
                  <button
                    key={slot.startAt}
                    onClick={() => bookSlot(slot)}
                    className="px-2 py-2 border border-gray-200 rounded-lg text-xs font-medium text-gray-700 hover:border-blue-500 hover:bg-blue-50"
                  >
                    {formatZonedTime(slot.startAt, branches.find((b) => b.id === form.branchId)?.timezone ?? 'UTC')}
                  </button>
                ))}
                {slots.length === 0 && <p className="col-span-3 text-xs text-gray-400 text-center py-4">Sin horarios disponibles ese día.</p>}
              </div>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}

function ViewToggleButton({
  icon: Icon,
  label,
  active,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-semibold transition ${
        active ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
      }`}
    >
      <Icon className="w-3.5 h-3.5" />
      {label}
    </button>
  );
}
