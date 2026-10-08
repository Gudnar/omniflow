'use client';

import { useEffect, useState } from 'react';
import { Plus, Truck, Building2, User } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/lib/toast-context';
import { apiGet, apiPost } from '@/lib/api-client';
import { Modal } from '@/components/ui/modal';
import type { DeliveryRoute, StaffUser } from '@/lib/types';
import { DeliveryRouteDetailPanel } from './delivery-route-detail-panel';

interface Branch {
  id: string;
  name: string;
}

const ROUTE_STATUS_LABELS: Record<string, string> = {
  PLANNED: 'Planificada',
  PREPARING: 'En preparación',
  IN_ROUTE: 'En ruta',
  PARTIALLY_COMPLETED: 'Completada parcialmente',
  COMPLETED: 'Completada',
  CANCELLED: 'Cancelada',
};

const ROUTE_STATUS_COLORS: Record<string, string> = {
  PLANNED: 'bg-gray-100 text-gray-600',
  PREPARING: 'bg-amber-50 text-amber-700',
  IN_ROUTE: 'bg-blue-50 text-blue-700',
  PARTIALLY_COMPLETED: 'bg-orange-50 text-orange-700',
  COMPLETED: 'bg-emerald-50 text-emerald-700',
  CANCELLED: 'bg-gray-100 text-gray-500',
};

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function emptyForm() {
  return { branchId: '', routeDate: todayIsoDate(), responsibleUserId: '', notes: '' };
}

export function DeliveryRoutesTab() {
  const { tokens } = useAuth();
  const toast = useToast();
  const [routes, setRoutes] = useState<DeliveryRoute[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [staff, setStaff] = useState<StaffUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const refetch = () => apiGet<DeliveryRoute[]>('/delivery/routes', tokens?.accessToken).then(setRoutes);

  useEffect(() => {
    if (!tokens) return;
    Promise.all([
      refetch(),
      apiGet<Branch[]>('/branches', tokens.accessToken).then(setBranches),
      apiGet<StaffUser[]>('/users', tokens.accessToken).then(setStaff).catch(() => []),
    ])
      .catch((err) => console.error('Error fetching delivery routes:', err))
      .finally(() => setLoading(false));
  }, [tokens]);

  const openCreate = () => {
    setForm({ ...emptyForm(), branchId: branches[0]?.id ?? '' });
    setShowCreate(true);
  };

  const create = async () => {
    if (!form.branchId) {
      toast.error('Elegí una sucursal');
      return;
    }
    setSaving(true);
    try {
      const route = await apiPost<DeliveryRoute>('/delivery/routes', tokens?.accessToken, {
        branchId: form.branchId,
        routeDate: form.routeDate,
        responsibleUserId: form.responsibleUserId || undefined,
        notes: form.notes || undefined,
      });
      await refetch();
      setShowCreate(false);
      setSelectedId(route.id);
      toast.success('Ruta creada correctamente');
    } catch (err: any) {
      toast.error(err.message ?? 'No se pudo crear la ruta');
    } finally {
      setSaving(false);
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
      <div className="flex justify-between items-start gap-3">
        <p className="text-sm text-gray-500 max-w-2xl">
          Agrupá los pedidos de entrega a domicilio del día en una ruta, asigná un responsable y marcalos entregados
          en el orden en que se reparten.
        </p>
        <button
          onClick={openCreate}
          disabled={branches.length === 0}
          className="shrink-0 flex items-center gap-1.5 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg text-sm font-semibold text-white transition"
        >
          <Plus className="w-4 h-4" />
          Nueva ruta
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_420px] gap-4 items-start">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {routes.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-12 md:col-span-2">Todavía no hay rutas de entrega.</p>
          )}
          {routes.map((route) => (
            <button
              key={route.id}
              onClick={() => setSelectedId(route.id)}
              className={`text-left bg-white rounded-xl border p-4 transition ${
                selectedId === route.id ? 'border-blue-400' : 'border-gray-200 hover:border-blue-300'
              }`}
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-1.5">
                  <Truck className="w-4 h-4 text-gray-400" />
                  <p className="text-sm font-bold text-gray-900">
                    {new Date(route.routeDate).toLocaleDateString('es-AR', { timeZone: 'UTC' })}
                  </p>
                </div>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${ROUTE_STATUS_COLORS[route.status]}`}>
                  {ROUTE_STATUS_LABELS[route.status]}
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-1">
                <Building2 className="w-3.5 h-3.5" />
                {branches.find((b) => b.id === route.branchId)?.name ?? route.branchId}
              </div>
              <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-1">
                <User className="w-3.5 h-3.5" />
                {route.responsibleUser?.email ?? 'Sin responsable'}
              </div>
              <p className="text-xs text-gray-400">
                {route._count?.stops ?? 0} parada{(route._count?.stops ?? 0) === 1 ? '' : 's'}
              </p>
            </button>
          ))}
        </div>

        {selectedId && (
          <div className="sticky top-6">
            <DeliveryRouteDetailPanel routeId={selectedId} onClose={() => setSelectedId(null)} onChanged={refetch} />
          </div>
        )}
      </div>

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Nueva ruta de entrega" size="md">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1.5">Sucursal</label>
            <select
              value={form.branchId}
              onChange={(e) => setForm({ ...form, branchId: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            >
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1.5">Fecha</label>
            <input
              type="date"
              value={form.routeDate}
              onChange={(e) => setForm({ ...form, routeDate: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1.5">Responsable (opcional)</label>
            <select
              value={form.responsibleUserId}
              onChange={(e) => setForm({ ...form, responsibleUserId: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            >
              <option value="">Sin asignar</option>
              {staff.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.email}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1.5">Notas (opcional)</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={() => setShowCreate(false)}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-900 hover:bg-gray-50 font-medium text-sm"
          >
            Cancelar
          </button>
          <button
            onClick={create}
            disabled={saving}
            className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg font-semibold text-sm"
          >
            Crear ruta
          </button>
        </div>
      </Modal>
    </div>
  );
}
