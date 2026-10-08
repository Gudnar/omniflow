'use client';

import { useEffect, useState } from 'react';
import { X, ArrowUp, ArrowDown, Trash2, Plus, CheckCircle2, XCircle, Play, Flag, MapPin } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/lib/toast-context';
import { apiGet, apiPost, apiPatch, apiDelete } from '@/lib/api-client';
import { Modal } from '@/components/ui/modal';
import type { DeliveryRoute, DeliveryRouteStopStatus, AvailableFulfillment, Driver, Vehicle } from '@/lib/types';

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

const STOP_STATUS_LABELS: Record<DeliveryRouteStopStatus, string> = {
  PENDING: 'Pendiente',
  COMPLETED: 'Entregado',
  FAILED: 'No se pudo entregar',
  SKIPPED: 'Omitida',
};

const STOP_STATUS_COLORS: Record<DeliveryRouteStopStatus, string> = {
  PENDING: 'bg-gray-100 text-gray-600',
  COMPLETED: 'bg-emerald-50 text-emerald-700',
  FAILED: 'bg-red-50 text-red-700',
  SKIPPED: 'bg-gray-100 text-gray-500',
};

export function DeliveryRouteDetailPanel({
  routeId,
  onClose,
  onChanged,
}: {
  routeId: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { tokens } = useAuth();
  const toast = useToast();
  const [route, setRoute] = useState<DeliveryRoute | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [available, setAvailable] = useState<AvailableFulfillment[]>([]);
  const [pickerLoading, setPickerLoading] = useState(false);

  const refetch = () =>
    apiGet<DeliveryRoute>(`/delivery/routes/${routeId}`, tokens?.accessToken).then(setRoute);

  useEffect(() => {
    if (!tokens) return;
    setLoading(true);
    refetch()
      .catch((err) => console.error('Error fetching delivery route:', err))
      .finally(() => setLoading(false));
  }, [tokens, routeId]);

  const run = async (action: () => Promise<any>, successMessage?: string) => {
    setBusy(true);
    try {
      await action();
      await refetch();
      onChanged();
      if (successMessage) toast.success(successMessage);
    } catch (err: any) {
      toast.error(err.message ?? 'No se pudo completar la acción');
    } finally {
      setBusy(false);
    }
  };

  const openPicker = async () => {
    if (!route) return;
    setShowPicker(true);
    setPickerLoading(true);
    try {
      const list = await apiGet<AvailableFulfillment[]>(
        `/delivery/routes/available-fulfillments?branchId=${route.branchId}`,
        tokens?.accessToken,
      );
      setAvailable(list);
    } catch (err: any) {
      toast.error(err.message ?? 'No se pudieron cargar los pedidos disponibles');
    } finally {
      setPickerLoading(false);
    }
  };

  const addStop = (fulfillmentId: string) =>
    run(() => apiPost(`/delivery/routes/${routeId}/stops`, tokens?.accessToken, { fulfillmentId }), 'Parada agregada');

  const removeStop = (stopId: string) =>
    run(() => apiDelete(`/delivery/routes/${routeId}/stops/${stopId}`, tokens?.accessToken));

  const moveStop = (index: number, direction: -1 | 1) => {
    if (!route) return;
    const stopIds = route.stops.map((s) => s.id);
    const target = index + direction;
    if (target < 0 || target >= stopIds.length) return;
    [stopIds[index], stopIds[target]] = [stopIds[target], stopIds[index]];
    run(() => apiPatch(`/delivery/routes/${routeId}/stops/reorder`, tokens?.accessToken, { stopIds }));
  };

  const completeStop = (stopId: string) =>
    run(() => apiPost(`/delivery/routes/${routeId}/stops/${stopId}/complete`, tokens?.accessToken, {}), 'Entrega confirmada');

  const failStop = (stopId: string) => {
    const note = window.prompt('¿Por qué no se pudo entregar? (opcional)') ?? undefined;
    run(() => apiPost(`/delivery/routes/${routeId}/stops/${stopId}/fail`, tokens?.accessToken, { note }));
  };

  const startRoute = () => run(() => apiPost(`/delivery/routes/${routeId}/start`, tokens?.accessToken, {}), 'Ruta iniciada');
  const completeRoute = () => run(() => apiPost(`/delivery/routes/${routeId}/complete`, tokens?.accessToken, {}), 'Ruta completada');
  const cancelRoute = () => {
    if (!window.confirm('¿Cancelar esta ruta?')) return;
    run(() => apiPatch(`/delivery/routes/${routeId}`, tokens?.accessToken, { status: 'CANCELLED' }));
  };

  if (loading || !route) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6 flex items-center justify-center min-h-[200px]">
        <div className="animate-spin w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full" />
      </div>
    );
  }

  const hasPendingStops = route.stops.some((s) => s.status === 'PENDING');

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="p-4 border-b border-gray-100 flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-bold text-gray-900">
            Ruta del {new Date(route.routeDate).toLocaleDateString('es-AR', { timeZone: 'UTC' })}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">
            {route.responsibleUser?.email ?? 'Sin responsable asignado'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${ROUTE_STATUS_COLORS[route.status]}`}>
            {ROUTE_STATUS_LABELS[route.status]}
          </span>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 text-gray-400">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <DriverAssignmentRow route={route} busy={busy} setBusy={setBusy} refetch={refetch} />

      <div className="p-4 space-y-2 max-h-[420px] overflow-y-auto">
        {route.stops.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-6">Todavía no hay paradas en esta ruta.</p>
        )}
        {route.stops.map((stop, index) => (
          <div key={stop.id} className="border border-gray-200 rounded-lg p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-2 min-w-0">
                <span className="text-xs font-bold text-gray-400 shrink-0 mt-0.5">{index + 1}</span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">
                    {stop.fulfillment.order?.contact.name ?? 'Cliente'} — Pedido {stop.fulfillment.order?.orderNumber}
                  </p>
                  {stop.fulfillment.order?.address && (
                    <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                      <MapPin className="w-3 h-3 shrink-0" /> {stop.fulfillment.order.address.addressLine}
                    </p>
                  )}
                  {stop.notes && <p className="text-xs text-gray-400 mt-0.5">{stop.notes}</p>}
                </div>
              </div>
              <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${STOP_STATUS_COLORS[stop.status]}`}>
                {STOP_STATUS_LABELS[stop.status]}
              </span>
            </div>

            <div className="flex items-center gap-1.5 mt-2">
              {route.status === 'PLANNED' || route.status === 'PREPARING' ? (
                <>
                  <button
                    disabled={busy || index === 0}
                    onClick={() => moveStop(index, -1)}
                    className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30 text-gray-500"
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    disabled={busy || index === route.stops.length - 1}
                    onClick={() => moveStop(index, 1)}
                    className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30 text-gray-500"
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                  </button>
                  <button
                    disabled={busy}
                    onClick={() => removeStop(stop.id)}
                    className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </>
              ) : null}
              {route.status === 'IN_ROUTE' && stop.status === 'PENDING' && (
                <>
                  <button
                    disabled={busy}
                    onClick={() => completeStop(stop.id)}
                    className="flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-semibold"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" /> Entregado
                  </button>
                  <button
                    disabled={busy}
                    onClick={() => failStop(stop.id)}
                    className="flex items-center gap-1 px-2 py-1 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 text-xs font-semibold"
                  >
                    <XCircle className="w-3.5 h-3.5" /> No se pudo
                  </button>
                </>
              )}
            </div>
          </div>
        ))}

        {(route.status === 'PLANNED' || route.status === 'PREPARING') && (
          <button
            onClick={openPicker}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-2 border border-dashed border-gray-300 rounded-lg text-sm text-gray-500 hover:border-blue-300 hover:text-blue-600"
          >
            <Plus className="w-4 h-4" /> Agregar parada
          </button>
        )}
      </div>

      <div className="p-4 border-t border-gray-100 flex gap-2">
        {(route.status === 'PLANNED' || route.status === 'PREPARING') && (
          <>
            <button
              disabled={busy || route.stops.length === 0}
              onClick={startRoute}
              className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg font-semibold text-sm"
            >
              <Play className="w-4 h-4" /> Iniciar ruta
            </button>
            <button
              disabled={busy}
              onClick={cancelRoute}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 text-sm font-medium"
            >
              Cancelar
            </button>
          </>
        )}
        {route.status === 'IN_ROUTE' && (
          <button
            disabled={busy || hasPendingStops}
            onClick={completeRoute}
            className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg font-semibold text-sm"
            title={hasPendingStops ? 'Resolvé todas las paradas antes de completar la ruta' : undefined}
          >
            <Flag className="w-4 h-4" /> Completar ruta
          </button>
        )}
      </div>

      <Modal open={showPicker} onClose={() => setShowPicker(false)} title="Agregar parada" size="lg">
        {pickerLoading ? (
          <div className="flex items-center justify-center py-10">
            <div className="animate-spin w-6 h-6 border-4 border-blue-200 border-t-blue-600 rounded-full" />
          </div>
        ) : available.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">
            No hay pedidos de entrega a domicilio disponibles en esta sucursal.
          </p>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {available.map((f) => (
              <button
                key={f.id}
                onClick={() => {
                  addStop(f.id);
                  setShowPicker(false);
                }}
                className="w-full text-left border border-gray-200 rounded-lg p-3 hover:border-blue-300"
              >
                <p className="text-sm font-semibold text-gray-900">
                  {f.order?.contact.name ?? 'Cliente'} — Pedido {f.order?.orderNumber}
                </p>
                {f.address && <p className="text-xs text-gray-500 mt-0.5">{f.address.addressLine}</p>}
              </button>
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
}

// Flota propia (Fase 20) — quién maneja esta ruta. Solo visible mientras la
// ruta no esté cancelada/completada; reasignar cierra la asignación vigente
// y crea una nueva (ver DeliveryAssignment.unassignedAt en el backend).
function DriverAssignmentRow({
  route,
  busy,
  setBusy,
  refetch,
}: {
  route: DeliveryRoute;
  busy: boolean;
  setBusy: (v: boolean) => void;
  refetch: () => Promise<void>;
}) {
  const { tokens } = useAuth();
  const toast = useToast();
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [driverId, setDriverId] = useState('');
  const [vehicleId, setVehicleId] = useState('');

  useEffect(() => {
    if (!tokens) return;
    Promise.all([
      apiGet<Driver[]>(`/delivery/drivers?branchId=${route.branchId}`, tokens.accessToken),
      apiGet<Vehicle[]>(`/delivery/vehicles?branchId=${route.branchId}`, tokens.accessToken),
    ])
      .then(([d, v]) => {
        setDrivers(d);
        setVehicles(v);
      })
      .catch((err) => console.error('Error fetching drivers/vehicles:', err));
  }, [tokens, route.branchId]);

  const currentAssignment = route.assignments[0];
  const canAssign = route.status !== 'CANCELLED' && route.status !== 'COMPLETED' && route.status !== 'PARTIALLY_COMPLETED';

  const assign = async () => {
    if (!driverId) {
      toast.error('Elegí un conductor');
      return;
    }
    setBusy(true);
    try {
      await apiPost(`/delivery/routes/${route.id}/assign-driver`, tokens?.accessToken, {
        driverId,
        vehicleId: vehicleId || undefined,
      });
      await refetch();
      toast.success('Conductor asignado correctamente');
    } catch (err: any) {
      toast.error(err.message ?? 'No se pudo asignar el conductor');
    } finally {
      setBusy(false);
    }
  };

  if (drivers.length === 0 && !currentAssignment) return null;

  return (
    <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
      {currentAssignment && (
        <p className="text-xs text-gray-600 mb-2">
          Asignado a <span className="font-semibold">{currentAssignment.driver.name}</span>
          {currentAssignment.vehicle && ` · ${currentAssignment.vehicle.label ?? currentAssignment.vehicle.type}`}
        </p>
      )}
      {canAssign && drivers.length > 0 && (
        <div className="flex items-center gap-2">
          <select
            value={driverId}
            onChange={(e) => setDriverId(e.target.value)}
            className="flex-1 px-2 py-1.5 border border-gray-300 rounded-lg text-xs"
          >
            <option value="">{currentAssignment ? 'Reasignar a...' : 'Elegir conductor'}</option>
            {drivers.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
          <select
            value={vehicleId}
            onChange={(e) => setVehicleId(e.target.value)}
            className="flex-1 px-2 py-1.5 border border-gray-300 rounded-lg text-xs"
          >
            <option value="">Sin vehículo</option>
            {vehicles.map((v) => (
              <option key={v.id} value={v.id}>
                {v.label ?? v.type}
              </option>
            ))}
          </select>
          <button
            onClick={assign}
            disabled={busy}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold shrink-0"
          >
            Asignar
          </button>
        </div>
      )}
    </div>
  );
}
