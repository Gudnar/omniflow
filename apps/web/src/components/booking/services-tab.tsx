'use client';

import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/lib/toast-context';
import { apiGet, apiPost, apiPatch, apiDelete, ApiError } from '@/lib/api-client';
import type { BookingService, BookingServiceStatus } from '@/lib/types';
import { Modal } from '@/components/ui/modal';

const EMPTY_FORM = { name: '', slug: '', description: '', durationMinutes: 30, price: 0, status: 'ACTIVE' as BookingServiceStatus };

// The slug is an internal identifier only (never shown in a customer-facing
// URL), so it's derived from the name instead of asking the operator to fill
// in an unfamiliar field — that's what was silently blocking creation before.
function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-+|-+$)/g, '');
}

export function ServicesTab() {
  const { tokens } = useAuth();
  const [services, setServices] = useState<BookingService[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [staffUserId, setStaffUserId] = useState<Record<string, string>>({});
  const toast = useToast();

  const refetch = () => apiGet<BookingService[]>('/booking/services', tokens?.accessToken).then(setServices);

  useEffect(() => {
    if (!tokens) return;
    refetch()
      .catch((err) => console.error('Error fetching services:', err))
      .finally(() => setLoading(false));
  }, [tokens]);

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setShowModal(true);
  };

  const openEdit = (s: BookingService) => {
    setEditingId(s.id);
    setForm({ name: s.name, slug: s.slug, description: s.description ?? '', durationMinutes: s.durationMinutes, price: s.price, status: s.status });
    setShowModal(true);
  };

  const save = async () => {
    if (!form.name.trim()) {
      toast.error('El nombre del servicio es obligatorio');
      return;
    }
    const baseSlug = editingId ? form.slug : slugify(form.name);
    const payload = { ...form, slug: baseSlug, description: form.description || undefined };
    try {
      if (editingId) {
        await apiPatch(`/booking/services/${editingId}`, tokens?.accessToken, payload);
      } else {
        try {
          await apiPost('/booking/services', tokens?.accessToken, payload);
        } catch (err) {
          // Same-name collision on the auto-generated slug — retry once with a
          // short unique suffix instead of surfacing a confusing slug error.
          if (err instanceof ApiError && err.status === 409) {
            await apiPost('/booking/services', tokens?.accessToken, {
              ...payload,
              slug: `${baseSlug}-${Date.now().toString(36).slice(-4)}`,
            });
          } else {
            throw err;
          }
        }
      }
      await refetch();
      setShowModal(false);
      toast.success(editingId ? 'Servicio actualizado correctamente' : 'Servicio creado correctamente');
    } catch (err: any) {
      toast.error(err.message ?? 'No se pudo guardar el servicio');
    }
  };

  const remove = async (id: string) => {
    if (!confirm('¿Eliminar este servicio?')) return;
    try {
      await apiDelete(`/booking/services/${id}`, tokens?.accessToken);
      await refetch();
      toast.success('Servicio eliminado correctamente');
    } catch (err: any) {
      toast.error(err.message ?? 'No se pudo eliminar el servicio');
    }
  };

  const addStaff = async (serviceId: string) => {
    const userId = staffUserId[serviceId];
    if (!userId?.trim()) return;
    try {
      await apiPost(`/booking/services/${serviceId}/staff/${userId}`, tokens?.accessToken, {});
      setStaffUserId({ ...staffUserId, [serviceId]: '' });
      await refetch();
      toast.success('Especialista agregado correctamente');
    } catch (err: any) {
      toast.error(err.message ?? 'No se pudo agregar el especialista');
    }
  };

  const removeStaff = async (serviceId: string, userId: string) => {
    try {
      await apiDelete(`/booking/services/${serviceId}/staff/${userId}`, tokens?.accessToken);
      await refetch();
      toast.success('Especialista quitado correctamente');
    } catch (err: any) {
      toast.error(err.message ?? 'No se pudo quitar el especialista');
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
      <div className="flex justify-end">
        <button
          onClick={openCreate}
          className="flex items-center gap-1.5 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-semibold text-white transition"
        >
          <Plus className="w-4 h-4" />
          Nuevo servicio
        </button>
      </div>

      <div className="space-y-3">
        {services.map((s) => (
          <div key={s.id} className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-gray-900">{s.name}</p>
                <p className="text-xs text-gray-400">{s.durationMinutes} min · Bs. {s.price.toFixed(2)}</p>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                    s.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  {s.status === 'ACTIVE' ? 'Activo' : 'Inactivo'}
                </span>
                <button onClick={() => openEdit(s)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => remove(s.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-500">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className="mt-3 pt-3 border-t border-gray-100">
              <p className="text-xs font-semibold text-gray-600 mb-2">Staff calificado</p>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {s.qualifiedUsers.map((q) => (
                  <span key={q.userId} className="flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-blue-50 text-blue-700">
                    {q.userId}
                    <button onClick={() => removeStaff(s.id, q.userId)} className="opacity-60 hover:opacity-100">✕</button>
                  </span>
                ))}
                {s.qualifiedUsers.length === 0 && <span className="text-xs text-gray-400">Sin staff calificado.</span>}
              </div>
              <div className="flex items-center gap-2">
                <input
                  value={staffUserId[s.id] ?? ''}
                  onChange={(e) => setStaffUserId({ ...staffUserId, [s.id]: e.target.value })}
                  placeholder="ID de usuario"
                  className="flex-1 px-2 py-1.5 border border-gray-200 rounded-lg text-xs"
                />
                <button onClick={() => addStaff(s.id)} className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold">
                  Calificar
                </button>
              </div>
            </div>
          </div>
        ))}
        {services.length === 0 && <p className="text-sm text-gray-400 text-center py-8">Sin servicios todavía.</p>}
      </div>

      <Modal open={showModal} onClose={() => setShowModal(false)} title={editingId ? 'Editar servicio' : 'Nuevo servicio'}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1.5">Nombre</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1.5">Descripción</label>
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-1.5">Duración (min)</label>
              <input type="number" value={form.durationMinutes} onChange={(e) => setForm({ ...form, durationMinutes: Number(e.target.value) })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-1.5">Precio (Bs.)</label>
              <input type="number" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: Number(e.target.value) })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1.5">Estado</label>
            <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as BookingServiceStatus })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white">
              <option value="ACTIVE">Activo</option>
              <option value="INACTIVE">Inactivo</option>
            </select>
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={() => setShowModal(false)} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-900 hover:bg-gray-50 font-medium text-sm">
            Cancelar
          </button>
          <button onClick={save} className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold text-sm">
            {editingId ? 'Actualizar' : 'Crear'}
          </button>
        </div>
      </Modal>
    </div>
  );
}
