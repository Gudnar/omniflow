'use client';

import { useEffect, useState } from 'react';
import { ArrowRight, CheckCircle2, Hand, CalendarClock, Users, QrCode, Image as ImageIcon } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/lib/toast-context';
import { apiGet, apiPatch } from '@/lib/api-client';
import type { Tenant, BookingService, BookingResource } from '@/lib/types';

interface Branch {
  id: string;
  name: string;
  minBookingLeadDays: number;
}

export function BookingsTab() {
  const { tokens } = useAuth();
  const toast = useToast();
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [services, setServices] = useState<BookingService[]>([]);
  const [resources, setResources] = useState<BookingResource[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!tokens) return;
    Promise.all([
      apiGet<Tenant>('/tenant', tokens.accessToken),
      apiGet<BookingService[]>('/booking/services', tokens.accessToken).catch(() => []),
      apiGet<BookingResource[]>('/booking/resources', tokens.accessToken).catch(() => []),
      apiGet<Branch[]>('/branches', tokens.accessToken).catch(() => []),
    ])
      .then(([tenantData, servicesData, resourcesData, branchesData]) => {
        setTenant(tenantData);
        setServices(servicesData);
        setResources(resourcesData);
        setBranches(branchesData);
      })
      .catch((err) => console.error('Error fetching booking settings:', err))
      .finally(() => setLoading(false));
  }, [tokens]);

  const setApprovalMode = async (mode: 'AUTOMATIC' | 'MANUAL') => {
    if (!tenant || tenant.appointmentApprovalMode === mode) return;
    setSaving(true);
    try {
      await apiPatch('/tenant', tokens?.accessToken, { appointmentApprovalMode: mode });
      setTenant({ ...tenant, appointmentApprovalMode: mode });
      toast.success('Modo de aprobación actualizado correctamente');
    } catch (err: any) {
      toast.error(err.message ?? 'No se pudo actualizar el modo de aprobación');
    } finally {
      setSaving(false);
    }
  };

  const toggleImageSetting = async (field: 'sendAppointmentQrCode' | 'sendAppointmentReceiptImage') => {
    if (!tenant) return;
    const value = !tenant[field];
    setTenant({ ...tenant, [field]: value });
    try {
      await apiPatch('/tenant', tokens?.accessToken, { [field]: value });
    } catch (err: any) {
      setTenant({ ...tenant, [field]: !value });
      toast.error(err.message ?? 'No se pudo actualizar la configuración');
    }
  };

  if (loading || !tenant) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="animate-spin w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full" />
      </div>
    );
  }

  const activeServices = services.filter((s) => s.status === 'ACTIVE');
  const activeResources = resources.filter((r) => r.status === 'ACTIVE');

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
      <div className="space-y-5">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-base font-bold text-gray-900 mb-1">Aprobación de citas</h3>
          <p className="text-sm text-gray-500 mb-4">
            Define si las citas se confirman solas al reservarse o requieren tu aprobación antes de quedar en firme.
          </p>

          <div className="space-y-3">
            <button
              onClick={() => setApprovalMode('AUTOMATIC')}
              disabled={saving}
              className={`w-full flex items-start gap-3 p-4 rounded-lg border text-left transition disabled:opacity-50 ${
                tenant.appointmentApprovalMode === 'AUTOMATIC'
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:bg-gray-50'
              }`}
            >
              <CheckCircle2
                className={`w-5 h-5 mt-0.5 shrink-0 ${
                  tenant.appointmentApprovalMode === 'AUTOMATIC' ? 'text-blue-600' : 'text-gray-300'
                }`}
              />
              <div>
                <p className="text-sm font-semibold text-gray-900">Automática</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  La cita queda confirmada apenas el cliente la reserva. No requiere revisión manual.
                </p>
              </div>
            </button>

            <button
              onClick={() => setApprovalMode('MANUAL')}
              disabled={saving}
              className={`w-full flex items-start gap-3 p-4 rounded-lg border text-left transition disabled:opacity-50 ${
                tenant.appointmentApprovalMode === 'MANUAL'
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:bg-gray-50'
              }`}
            >
              <Hand
                className={`w-5 h-5 mt-0.5 shrink-0 ${
                  tenant.appointmentApprovalMode === 'MANUAL' ? 'text-blue-600' : 'text-gray-300'
                }`}
              />
              <div>
                <p className="text-sm font-semibold text-gray-900">Manual</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  La cita queda pendiente hasta que un operador la aprueba o la rechaza desde el detalle de la cita.
                </p>
              </div>
            </button>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-base font-bold text-gray-900 mb-1">Confirmación por imagen</h3>
          <p className="text-sm text-gray-500 mb-4">
            Al reservarse una cita, enviar automáticamente estas imágenes a la conversación del cliente.
          </p>

          <div className="divide-y divide-gray-100">
            <div className="flex items-center justify-between gap-4 py-3">
              <div className="flex items-start gap-2.5">
                <QrCode className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-gray-900">Código QR</p>
                  <p className="text-xs text-gray-500 mt-0.5">Con los datos de la cita (cliente, servicio, fecha).</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => toggleImageSetting('sendAppointmentQrCode')}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition shrink-0 ${
                  tenant.sendAppointmentQrCode ? 'bg-blue-600' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                    tenant.sendAppointmentQrCode ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between gap-4 py-3">
              <div className="flex items-start gap-2.5">
                <ImageIcon className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-gray-900">Imagen de comprobante</p>
                  <p className="text-xs text-gray-500 mt-0.5">Detalle del servicio, horario y total, como un recibo.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => toggleImageSetting('sendAppointmentReceiptImage')}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition shrink-0 ${
                  tenant.sendAppointmentReceiptImage ? 'bg-blue-600' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                    tenant.sendAppointmentReceiptImage ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-base font-bold text-gray-900 mb-1 flex items-center gap-2">
            <CalendarClock className="w-4 h-4 text-gray-400" /> Anticipación mínima por sucursal
          </h3>
          <p className="text-sm text-gray-500 mb-4">
            Días mínimos de anticipación exigidos para reservar desde el storefront público. Para editarlos o
            configurar fechas bloqueadas, ve a Reservas → Disponibilidad.
          </p>

          {branches.length > 0 ? (
            <div className="space-y-2">
              {branches.map((b) => (
                <div
                  key={b.id}
                  className="flex items-center justify-between text-sm bg-gray-50 rounded-lg px-3 py-2"
                >
                  <span className="text-gray-700">{b.name}</span>
                  <span className="text-xs font-medium text-gray-500">
                    {b.minBookingLeadDays} día{b.minBookingLeadDays === 1 ? '' : 's'} de anticipación
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400">Aún no tienes sucursales configuradas.</p>
          )}
        </div>
      </div>

      <div className="space-y-5">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-base font-bold text-gray-900 mb-1 flex items-center gap-2">
            <Users className="w-4 h-4 text-gray-400" /> Servicios y recursos
          </h3>
          <p className="text-sm text-gray-500 mb-4">
            Resumen de lo que ya configuraste. Para crear o editar servicios, especialistas, salas o equipos, ve a la
            pestaña "Reservas" del menú principal.
          </p>

          <div className="grid grid-cols-2 gap-3 mb-2">
            <div className="bg-gray-50 rounded-lg px-3 py-3 text-center">
              <p className="text-xl font-bold text-gray-900">{activeServices.length}</p>
              <p className="text-xs text-gray-500">
                {activeServices.length === 1 ? 'servicio activo' : 'servicios activos'}
                {services.length > activeServices.length && ` (${services.length} en total)`}
              </p>
            </div>
            <div className="bg-gray-50 rounded-lg px-3 py-3 text-center">
              <p className="text-xl font-bold text-gray-900">{activeResources.length}</p>
              <p className="text-xs text-gray-500">
                {activeResources.length === 1 ? 'recurso activo' : 'recursos activos'}
                {resources.length > activeResources.length && ` (${resources.length} en total)`}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-base font-bold text-gray-900 mb-1">Gestión de citas</h3>
          <p className="text-sm text-gray-500 mb-4">
            Revisa, aprueba/rechaza, reprograma y da seguimiento a cada cita, además de administrar servicios,
            recursos y disponibilidad.
          </p>
          <a
            href="/dashboard/booking"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:underline"
          >
            Ir a Reservas y Citas <ArrowRight className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>
    </div>
  );
}
