'use client';

import { useEffect, useState } from 'react';
import { ArrowRight, Bell, PackageCheck, CalendarClock, Clock } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/lib/toast-context';
import { apiGet, apiPatch } from '@/lib/api-client';
import type { Tenant } from '@/lib/types';

export function NotificationsTab() {
  const { tokens } = useAuth();
  const toast = useToast();
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [windowHours, setWindowHours] = useState<number | ''>('');
  const [savingWindow, setSavingWindow] = useState(false);

  useEffect(() => {
    if (!tokens) return;
    apiGet<Tenant>('/tenant', tokens.accessToken)
      .then(setTenant)
      .catch((err) => console.error('Error fetching tenant:', err))
      .finally(() => setLoading(false));
  }, [tokens]);

  useEffect(() => {
    if (tenant) setWindowHours(tenant.whatsappFreeWindowHours);
  }, [tenant]);

  const saveWindowHours = async () => {
    if (!tenant || windowHours === '' || windowHours < 1) return;
    setSavingWindow(true);
    try {
      await apiPatch('/tenant', tokens?.accessToken, { whatsappFreeWindowHours: windowHours });
      setTenant({ ...tenant, whatsappFreeWindowHours: windowHours });
      toast.success('Ventana de WhatsApp actualizada');
    } catch (err: any) {
      toast.error(err.message ?? 'No se pudo actualizar la ventana');
    } finally {
      setSavingWindow(false);
    }
  };

  const toggle = async (
    field:
      | 'notifyOnOrderPendingApproval'
      | 'notifyOnAppointmentPendingApproval'
      | 'notifyOnOrderConfirmed'
      | 'notifyOnAppointmentConfirmed',
  ) => {
    if (!tenant) return;
    const value = !tenant[field];
    setSaving(true);
    try {
      await apiPatch('/tenant', tokens?.accessToken, { [field]: value });
      setTenant({ ...tenant, [field]: value });
      toast.success('Preferencia de notificación actualizada');
    } catch (err: any) {
      toast.error(err.message ?? 'No se pudo actualizar la preferencia');
    } finally {
      setSaving(false);
    }
  };

  if (loading || !tenant) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="animate-spin w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full" />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
      <div className="space-y-5">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-base font-bold text-gray-900 mb-1 flex items-center gap-2">
            <Bell className="w-4 h-4 text-gray-400" /> Notificaciones en la campana
          </h3>
          <p className="text-sm text-gray-500 mb-4">
            Se muestran en la campana del panel para todo el equipo cuando algo necesita atención.
          </p>

          <div className="space-y-3">
            <label className="w-full flex items-start gap-3 p-4 rounded-lg border border-gray-200 cursor-pointer">
              <input
                type="checkbox"
                className="mt-1"
                checked={tenant.notifyOnOrderPendingApproval}
                disabled={saving}
                onChange={() => toggle('notifyOnOrderPendingApproval')}
              />
              <div>
                <p className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
                  <PackageCheck className="w-3.5 h-3.5 text-gray-400" /> Pedido pendiente de aprobación
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Avisa al equipo cuando un pedido nace pendiente (modo de aprobación Manual en Pedidos y entregas).
                </p>
              </div>
            </label>

            <label className="w-full flex items-start gap-3 p-4 rounded-lg border border-gray-200 cursor-pointer">
              <input
                type="checkbox"
                className="mt-1"
                checked={tenant.notifyOnAppointmentPendingApproval}
                disabled={saving}
                onChange={() => toggle('notifyOnAppointmentPendingApproval')}
              />
              <div>
                <p className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
                  <CalendarClock className="w-3.5 h-3.5 text-gray-400" /> Cita pendiente de aprobación
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Avisa al equipo cuando una cita nace pendiente (modo de aprobación Manual en Reservas y servicios).
                </p>
              </div>
            </label>

            <label className="w-full flex items-start gap-3 p-4 rounded-lg border border-gray-200 cursor-pointer">
              <input
                type="checkbox"
                className="mt-1"
                checked={tenant.notifyOnOrderConfirmed}
                disabled={saving}
                onChange={() => toggle('notifyOnOrderConfirmed')}
              />
              <div>
                <p className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
                  <PackageCheck className="w-3.5 h-3.5 text-gray-400" /> Pedido confirmado
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Avisa al equipo de toda venta confirmada automáticamente (modo de aprobación Automático, el más común en el storefront).
                </p>
              </div>
            </label>

            <label className="w-full flex items-start gap-3 p-4 rounded-lg border border-gray-200 cursor-pointer">
              <input
                type="checkbox"
                className="mt-1"
                checked={tenant.notifyOnAppointmentConfirmed}
                disabled={saving}
                onChange={() => toggle('notifyOnAppointmentConfirmed')}
              />
              <div>
                <p className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
                  <CalendarClock className="w-3.5 h-3.5 text-gray-400" /> Cita confirmada
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Avisa al equipo de toda reserva confirmada automáticamente (modo de aprobación Automático).
                </p>
              </div>
            </label>
          </div>
        </div>
      </div>

      <div className="space-y-5">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-base font-bold text-gray-900 mb-1 flex items-center gap-2">
            <Clock className="w-4 h-4 text-gray-400" /> Costo de mensajes de WhatsApp
          </h3>
          <p className="text-sm text-gray-500 mb-4">
            Pasadas estas horas desde el último mensaje del cliente, Meta empieza a cobrar cada respuesta. En vez de
            seguir respondiendo por WhatsApp, el sistema le manda las opciones (tienda, reservar, chat web) y lo
            deriva al chat web, donde la conversación sigue siendo gratis.
          </p>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={1}
              value={windowHours}
              onChange={(e) => setWindowHours(e.target.value === '' ? '' : Number(e.target.value))}
              disabled={savingWindow}
              className="w-24 px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
            <span className="text-sm text-gray-500">horas</span>
            <button
              onClick={saveWindowHours}
              disabled={savingWindow || windowHours === tenant.whatsappFreeWindowHours}
              className="ml-auto px-3 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium disabled:opacity-50"
            >
              Guardar
            </button>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-base font-bold text-gray-900 mb-1">Automatizaciones avanzadas</h3>
          <p className="text-sm text-gray-500 mb-4">
            Para notificar al equipo (o a una persona en particular) ante cualquier otro evento —un pedido cancelado,
            una cita completada, un carrito abandonado, etc.— crea una automatización con la acción{' '}
            <span className="font-semibold text-gray-700">"Notificar al equipo"</span> en Workflows.
          </p>
          <a
            href="/dashboard/flows"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:underline"
          >
            Ir a Workflows <ArrowRight className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>
    </div>
  );
}
