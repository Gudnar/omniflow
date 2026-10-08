'use client';

import { useEffect, useState } from 'react';
import { Plus, Trash2, Bike } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/lib/toast-context';
import { apiGet, apiPost, apiPatch, apiDelete } from '@/lib/api-client';
import { Modal } from '@/components/ui/modal';
import type {
  Driver,
  Vehicle,
  VehicleType,
  DeliveryZone,
  DeliveryZoneMatchType,
  DeliveryProviderConfig,
  DeliveryProviderType,
  DeliveryOperationMode,
} from '@/lib/types';

interface Branch {
  id: string;
  name: string;
}

const VEHICLE_LABELS: Record<VehicleType, string> = {
  MOTORCYCLE: 'Moto',
  CAR: 'Auto',
  BICYCLE: 'Bicicleta',
  VAN: 'Camioneta',
  OTHER: 'Otro',
};

// Fase 20 (primer incremento): conductores/vehículos de flota propia, zonas
// y tarifas de envío, y método de entrega por sucursal (flota propia o
// notificar por Telegram) — todo alcanzado por sucursal, por eso el
// selector de sucursal es compartido entre las tres secciones.
export function DeliverySection() {
  const { tokens } = useAuth();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchId, setBranchId] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tokens) return;
    apiGet<Branch[]>('/branches', tokens.accessToken)
      .then((rows) => {
        setBranches(rows);
        setBranchId(rows[0]?.id ?? '');
      })
      .catch((err) => console.error('Error fetching branches:', err))
      .finally(() => setLoading(false));
  }, [tokens]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[20vh]">
        <div className="animate-spin w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full" />
      </div>
    );
  }

  if (branches.length === 0) {
    return <p className="text-sm text-gray-400">Creá una sucursal primero para configurar entregas.</p>;
  }

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <label className="block text-sm font-medium text-gray-900 mb-1.5">Sucursal</label>
        <select
          value={branchId}
          onChange={(e) => setBranchId(e.target.value)}
          className="w-full max-w-xs px-3 py-2 border border-gray-300 rounded-lg text-sm"
        >
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      </div>

      <DeliveryMethodCard branchId={branchId} />
      <DeliveryZonesCard branchId={branchId} />
      <DriversVehiclesCard branchId={branchId} />
    </div>
  );
}

function DeliveryMethodCard({ branchId }: { branchId: string }) {
  const { tokens } = useAuth();
  const toast = useToast();
  const [configs, setConfigs] = useState<DeliveryProviderConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [type, setType] = useState<DeliveryProviderType>('OWN_FLEET');
  const [operationMode, setOperationMode] = useState<DeliveryOperationMode>('ROUTE_BASED');
  const [chatId, setChatId] = useState('');
  const [botToken, setBotToken] = useState('');

  const refetch = () => apiGet<DeliveryProviderConfig[]>('/delivery/provider-config', tokens?.accessToken).then(setConfigs);

  useEffect(() => {
    if (!tokens) return;
    refetch()
      .catch((err) => console.error('Error fetching delivery provider config:', err))
      .finally(() => setLoading(false));
  }, [tokens]);

  useEffect(() => {
    const current = configs.find((c) => c.branchId === branchId) ?? configs.find((c) => c.branchId === null);
    setType(current?.type ?? 'OWN_FLEET');
    setOperationMode(current?.operationMode ?? 'ROUTE_BASED');
    setChatId(current?.config?.chatId ?? '');
    setBotToken('');
  }, [configs, branchId]);

  const save = async () => {
    if (type === 'TELEGRAM_NOTIFY' && !chatId.trim()) {
      toast.error('El chat ID de Telegram es obligatorio');
      return;
    }
    setSaving(true);
    try {
      await apiPost('/delivery/provider-config', tokens?.accessToken, {
        branchId,
        type,
        ...(type === 'TELEGRAM_NOTIFY' && { operationMode, chatId, ...(botToken && { botToken }) }),
      });
      await refetch();
      setBotToken('');
      toast.success('Método de entrega guardado correctamente');
    } catch (err: any) {
      toast.error(err.message ?? 'No se pudo guardar el método de entrega');
    } finally {
      setSaving(false);
    }
  };

  const activeConfig = configs.find((c) => c.branchId === branchId);

  if (loading) return null;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <h3 className="text-base font-bold text-gray-900 mb-1">Método de entrega de esta sucursal</h3>
      <p className="text-sm text-gray-500 mb-4">
        Cómo se avisa que hay un pedido para entregar — con tu propia flota (conductores) o notificando a un grupo
        de Telegram para que alguien lo reparta manualmente.
      </p>

      <div className="space-y-2 mb-4">
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input type="radio" checked={type === 'OWN_FLEET'} onChange={() => setType('OWN_FLEET')} />
          Flota propia (asignar conductor y vehículo manualmente)
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input type="radio" checked={type === 'TELEGRAM_NOTIFY'} onChange={() => setType('TELEGRAM_NOTIFY')} />
          Notificar por Telegram
        </label>
      </div>

      {type === 'TELEGRAM_NOTIFY' && (
        <div className="pl-6 mb-4">
          <div className="space-y-2 mb-3">
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="radio"
                checked={operationMode === 'ROUTE_BASED'}
                onChange={() => setOperationMode('ROUTE_BASED')}
              />
              Por rutas planificadas — avisa al agregar el pedido a una ruta
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="radio"
                checked={operationMode === 'IMMEDIATE'}
                onChange={() => setOperationMode('IMMEDIATE')}
              />
              Entrega individual — avisa apenas se confirma el pedido, sin ruta
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Chat ID</label>
            <input
              value={chatId}
              onChange={(e) => setChatId(e.target.value)}
              placeholder="-100123456789"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Bot token {activeConfig?.hasBotToken && '(ya configurado — dejalo vacío para no cambiarlo)'}
            </label>
            <input
              value={botToken}
              onChange={(e) => setBotToken(e.target.value)}
              placeholder={activeConfig?.hasBotToken ? '••••••••' : '123456:ABC-DEF...'}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>
          </div>
        </div>
      )}

      <button
        onClick={save}
        disabled={saving}
        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg font-semibold text-sm"
      >
        Guardar
      </button>
    </div>
  );
}

function emptyZoneForm() {
  return {
    id: null as string | null,
    name: '',
    matchType: 'ZONE_LABEL' as DeliveryZoneMatchType,
    zoneLabels: '',
    radiusKm: '',
    baseFee: '',
    freeOverAmount: '',
  };
}

function DeliveryZonesCard({ branchId }: { branchId: string }) {
  const { tokens } = useAuth();
  const toast = useToast();
  const [zones, setZones] = useState<DeliveryZone[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyZoneForm());

  const refetch = () => apiGet<DeliveryZone[]>(`/delivery/zones?branchId=${branchId}`, tokens?.accessToken).then(setZones);

  useEffect(() => {
    if (!tokens || !branchId) return;
    setLoading(true);
    refetch()
      .catch((err) => console.error('Error fetching delivery zones:', err))
      .finally(() => setLoading(false));
  }, [tokens, branchId]);

  const openCreate = () => {
    setForm(emptyZoneForm());
    setShowModal(true);
  };

  const openEdit = (zone: DeliveryZone) => {
    setForm({
      id: zone.id,
      name: zone.name,
      matchType: zone.matchType,
      zoneLabels: zone.zoneLabels.join(', '),
      radiusKm: zone.radiusKm?.toString() ?? '',
      baseFee: zone.baseFee.toString(),
      freeOverAmount: zone.freeOverAmount?.toString() ?? '',
    });
    setShowModal(true);
  };

  const save = async () => {
    if (!form.name.trim() || !form.baseFee) {
      toast.error('Nombre y tarifa son obligatorios');
      return;
    }
    const payload = {
      branchId,
      name: form.name,
      matchType: form.matchType,
      zoneLabels: form.matchType === 'ZONE_LABEL' ? form.zoneLabels.split(',').map((s) => s.trim()).filter(Boolean) : undefined,
      radiusKm: form.matchType === 'RADIUS_KM' ? Number(form.radiusKm) : undefined,
      baseFee: Number(form.baseFee),
      freeOverAmount: form.freeOverAmount ? Number(form.freeOverAmount) : undefined,
    };
    setSaving(true);
    try {
      if (form.id) {
        await apiPatch(`/delivery/zones/${form.id}`, tokens?.accessToken, payload);
      } else {
        await apiPost('/delivery/zones', tokens?.accessToken, payload);
      }
      await refetch();
      setShowModal(false);
      toast.success('Zona guardada correctamente');
    } catch (err: any) {
      toast.error(err.message ?? 'No se pudo guardar la zona');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (zone: DeliveryZone) => {
    if (!confirm(`¿Eliminar la zona "${zone.name}"?`)) return;
    try {
      await apiDelete(`/delivery/zones/${zone.id}`, tokens?.accessToken);
      await refetch();
      toast.success('Zona eliminada correctamente');
    } catch (err: any) {
      toast.error(err.message ?? 'No se pudo eliminar la zona');
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex justify-between items-start gap-3 mb-1">
        <h3 className="text-base font-bold text-gray-900">Zonas y tarifas de envío</h3>
        <button
          onClick={openCreate}
          className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 rounded-lg text-xs font-semibold text-white"
        >
          <Plus className="w-3.5 h-3.5" />
          Nueva zona
        </button>
      </div>
      <p className="text-sm text-gray-500 mb-4">
        Si no configurás ninguna zona, la entrega a domicilio de esta sucursal queda sin cargo. La primera zona que
        coincide con la dirección del cliente es la que se aplica.
      </p>

      {loading ? (
        <div className="flex justify-center py-6">
          <div className="animate-spin w-6 h-6 border-4 border-blue-200 border-t-blue-600 rounded-full" />
        </div>
      ) : zones.length === 0 ? (
        <p className="text-sm text-gray-400">Sin zonas configuradas.</p>
      ) : (
        <div className="space-y-2">
          {zones.map((zone) => (
            <div key={zone.id} className="flex items-center justify-between border border-gray-200 rounded-lg p-3">
              <button onClick={() => openEdit(zone)} className="text-left min-w-0">
                <p className="text-sm font-semibold text-gray-900">{zone.name}</p>
                <p className="text-xs text-gray-500">
                  {zone.matchType === 'ZONE_LABEL' ? zone.zoneLabels.join(', ') : `Radio ${zone.radiusKm} km`} —{' '}
                  {zone.baseFee} {zone.freeOverAmount ? `(gratis desde ${zone.freeOverAmount})` : ''}
                </p>
              </button>
              <button onClick={() => remove(zone)} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 shrink-0">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      <Modal open={showModal} onClose={() => setShowModal(false)} title={form.id ? 'Editar zona' : 'Nueva zona'} size="md">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1.5">Nombre</label>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Ej: Zona centro"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1.5">Cómo identificarla</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="radio"
                  checked={form.matchType === 'ZONE_LABEL'}
                  onChange={() => setForm({ ...form, matchType: 'ZONE_LABEL' })}
                />
                Por nombre de barrio/zona
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="radio"
                  checked={form.matchType === 'RADIUS_KM'}
                  onChange={() => setForm({ ...form, matchType: 'RADIUS_KM' })}
                />
                Por radio (km)
              </label>
            </div>
          </div>

          {form.matchType === 'ZONE_LABEL' ? (
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-1.5">Nombres de zona (separados por coma)</label>
              <input
                value={form.zoneLabels}
                onChange={(e) => setForm({ ...form, zoneLabels: e.target.value })}
                placeholder="centro, zona norte"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-1.5">Radio en km desde la sucursal</label>
              <input
                type="number"
                value={form.radiusKm}
                onChange={(e) => setForm({ ...form, radiusKm: e.target.value })}
                placeholder="5"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
              <p className="text-xs text-amber-700 mt-1">
                Necesita que esta sucursal tenga latitud/longitud configuradas.
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-1.5">Tarifa</label>
              <input
                type="number"
                value={form.baseFee}
                onChange={(e) => setForm({ ...form, baseFee: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-1.5">Envío gratis desde (opcional)</label>
              <input
                type="number"
                value={form.freeOverAmount}
                onChange={(e) => setForm({ ...form, freeOverAmount: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button onClick={() => setShowModal(false)} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-900 hover:bg-gray-50 font-medium text-sm">
            Cancelar
          </button>
          <button onClick={save} disabled={saving} className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg font-semibold text-sm">
            Guardar
          </button>
        </div>
      </Modal>
    </div>
  );
}

function DriversVehiclesCard({ branchId }: { branchId: string }) {
  const { tokens } = useAuth();
  const toast = useToast();
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [driverForm, setDriverForm] = useState({ name: '', phone: '' });
  const [vehicleForm, setVehicleForm] = useState<{ type: VehicleType; label: string; plate: string }>({
    type: 'MOTORCYCLE',
    label: '',
    plate: '',
  });
  const [showDriverModal, setShowDriverModal] = useState(false);
  const [showVehicleModal, setShowVehicleModal] = useState(false);

  const refetch = () =>
    Promise.all([
      apiGet<Driver[]>(`/delivery/drivers?branchId=${branchId}`, tokens?.accessToken),
      apiGet<Vehicle[]>(`/delivery/vehicles?branchId=${branchId}`, tokens?.accessToken),
    ]).then(([d, v]) => {
      setDrivers(d);
      setVehicles(v);
    });

  useEffect(() => {
    if (!tokens || !branchId) return;
    setLoading(true);
    refetch()
      .catch((err) => console.error('Error fetching drivers/vehicles:', err))
      .finally(() => setLoading(false));
  }, [tokens, branchId]);

  const createDriver = async () => {
    if (!driverForm.name.trim() || !driverForm.phone.trim()) {
      toast.error('Nombre y teléfono son obligatorios');
      return;
    }
    try {
      await apiPost('/delivery/drivers', tokens?.accessToken, { ...driverForm, branchId });
      await refetch();
      setShowDriverModal(false);
      setDriverForm({ name: '', phone: '' });
      toast.success('Conductor agregado correctamente');
    } catch (err: any) {
      toast.error(err.message ?? 'No se pudo agregar el conductor');
    }
  };

  const removeDriver = async (driver: Driver) => {
    if (!confirm(`¿Eliminar a ${driver.name}?`)) return;
    try {
      await apiDelete(`/delivery/drivers/${driver.id}`, tokens?.accessToken);
      await refetch();
    } catch (err: any) {
      toast.error(err.message ?? 'No se pudo eliminar — puede tener historial de rutas');
    }
  };

  const createVehicle = async () => {
    try {
      await apiPost('/delivery/vehicles', tokens?.accessToken, { ...vehicleForm, branchId });
      await refetch();
      setShowVehicleModal(false);
      setVehicleForm({ type: 'MOTORCYCLE', label: '', plate: '' });
      toast.success('Vehículo agregado correctamente');
    } catch (err: any) {
      toast.error(err.message ?? 'No se pudo agregar el vehículo');
    }
  };

  const removeVehicle = async (vehicle: Vehicle) => {
    if (!confirm('¿Eliminar este vehículo?')) return;
    try {
      await apiDelete(`/delivery/vehicles/${vehicle.id}`, tokens?.accessToken);
      await refetch();
    } catch (err: any) {
      toast.error(err.message ?? 'No se pudo eliminar el vehículo');
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-5 flex justify-center">
        <div className="animate-spin w-6 h-6 border-4 border-blue-200 border-t-blue-600 rounded-full" />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <h3 className="text-base font-bold text-gray-900 mb-4">Conductores y vehículos (flota propia)</h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div>
          <div className="flex justify-between items-center mb-2">
            <p className="text-sm font-semibold text-gray-700">Conductores</p>
            <button onClick={() => setShowDriverModal(true)} className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1">
              <Plus className="w-3.5 h-3.5" /> Agregar
            </button>
          </div>
          <div className="space-y-1.5">
            {drivers.length === 0 && <p className="text-xs text-gray-400">Sin conductores todavía.</p>}
            {drivers.map((d) => (
              <div key={d.id} className="flex items-center justify-between border border-gray-200 rounded-lg px-3 py-2">
                <span className="text-sm text-gray-700">
                  {d.name} <span className="text-gray-400">· {d.phone}</span>
                </span>
                <button onClick={() => removeDriver(d)} className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="flex justify-between items-center mb-2">
            <p className="text-sm font-semibold text-gray-700">Vehículos</p>
            <button onClick={() => setShowVehicleModal(true)} className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1">
              <Plus className="w-3.5 h-3.5" /> Agregar
            </button>
          </div>
          <div className="space-y-1.5">
            {vehicles.length === 0 && <p className="text-xs text-gray-400">Sin vehículos todavía.</p>}
            {vehicles.map((v) => (
              <div key={v.id} className="flex items-center justify-between border border-gray-200 rounded-lg px-3 py-2">
                <span className="text-sm text-gray-700 flex items-center gap-1.5">
                  <Bike className="w-3.5 h-3.5 text-gray-400" />
                  {v.label || VEHICLE_LABELS[v.type]} {v.plate && <span className="text-gray-400">· {v.plate}</span>}
                </span>
                <button onClick={() => removeVehicle(v)} className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      <Modal open={showDriverModal} onClose={() => setShowDriverModal(false)} title="Nuevo conductor" size="md">
        <div className="space-y-3">
          <input
            value={driverForm.name}
            onChange={(e) => setDriverForm({ ...driverForm, name: e.target.value })}
            placeholder="Nombre"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
          />
          <input
            value={driverForm.phone}
            onChange={(e) => setDriverForm({ ...driverForm, phone: e.target.value })}
            placeholder="Teléfono"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
          />
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={() => setShowDriverModal(false)} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-900 hover:bg-gray-50 font-medium text-sm">
            Cancelar
          </button>
          <button onClick={createDriver} className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold text-sm">
            Guardar
          </button>
        </div>
      </Modal>

      <Modal open={showVehicleModal} onClose={() => setShowVehicleModal(false)} title="Nuevo vehículo" size="md">
        <div className="space-y-3">
          <select
            value={vehicleForm.type}
            onChange={(e) => setVehicleForm({ ...vehicleForm, type: e.target.value as VehicleType })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
          >
            {Object.entries(VEHICLE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <input
            value={vehicleForm.label}
            onChange={(e) => setVehicleForm({ ...vehicleForm, label: e.target.value })}
            placeholder="Ej: Moto roja (opcional)"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
          />
          <input
            value={vehicleForm.plate}
            onChange={(e) => setVehicleForm({ ...vehicleForm, plate: e.target.value })}
            placeholder="Placa (opcional)"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
          />
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={() => setShowVehicleModal(false)} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-900 hover:bg-gray-50 font-medium text-sm">
            Cancelar
          </button>
          <button onClick={createVehicle} className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold text-sm">
            Guardar
          </button>
        </div>
      </Modal>
    </div>
  );
}
