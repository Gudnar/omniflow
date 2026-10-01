'use client';

import { useEffect, useState } from 'react';
import { ArrowRight, CheckCircle2, Hand, Truck } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/lib/toast-context';
import { apiGet, apiPatch } from '@/lib/api-client';
import type { Tenant, EcommerceStore, FulfillmentType } from '@/lib/types';

const FULFILLMENT_LABELS: Record<FulfillmentType, string> = {
  PICKUP: 'Retiro en sucursal',
  LOCAL_DELIVERY: 'Entrega a domicilio',
  SHIPPING: 'Envío por paquetería',
};

export function OrdersTab() {
  const { tokens } = useAuth();
  const toast = useToast();
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [store, setStore] = useState<EcommerceStore | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!tokens) return;
    Promise.all([
      apiGet<Tenant>('/tenant', tokens.accessToken),
      apiGet<EcommerceStore>('/ecommerce/store', tokens.accessToken).catch(() => null),
    ])
      .then(([tenantData, storeData]) => {
        setTenant(tenantData);
        setStore(storeData);
      })
      .catch((err) => console.error('Error fetching orders settings:', err))
      .finally(() => setLoading(false));
  }, [tokens]);

  const setApprovalMode = async (mode: 'AUTOMATIC' | 'MANUAL') => {
    if (!tenant || tenant.orderApprovalMode === mode) return;
    setSaving(true);
    try {
      await apiPatch('/tenant', tokens?.accessToken, { orderApprovalMode: mode });
      setTenant({ ...tenant, orderApprovalMode: mode });
      toast.success('Modo de aprobación actualizado correctamente');
    } catch (err: any) {
      toast.error(err.message ?? 'No se pudo actualizar el modo de aprobación');
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
          <h3 className="text-base font-bold text-gray-900 mb-1">Aprobación de pedidos</h3>
          <p className="text-sm text-gray-500 mb-4">
            Define si los pedidos del ecommerce se confirman solos o requieren tu aprobación antes de prepararse.
          </p>

          <div className="space-y-3">
            <button
              onClick={() => setApprovalMode('AUTOMATIC')}
              disabled={saving}
              className={`w-full flex items-start gap-3 p-4 rounded-lg border text-left transition disabled:opacity-50 ${
                tenant.orderApprovalMode === 'AUTOMATIC'
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:bg-gray-50'
              }`}
            >
              <CheckCircle2
                className={`w-5 h-5 mt-0.5 shrink-0 ${
                  tenant.orderApprovalMode === 'AUTOMATIC' ? 'text-blue-600' : 'text-gray-300'
                }`}
              />
              <div>
                <p className="text-sm font-semibold text-gray-900">Automática</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  El pedido se confirma en cuanto el cliente hace el pago o finaliza la compra. No requiere revisión manual.
                </p>
              </div>
            </button>

            <button
              onClick={() => setApprovalMode('MANUAL')}
              disabled={saving}
              className={`w-full flex items-start gap-3 p-4 rounded-lg border text-left transition disabled:opacity-50 ${
                tenant.orderApprovalMode === 'MANUAL'
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:bg-gray-50'
              }`}
            >
              <Hand
                className={`w-5 h-5 mt-0.5 shrink-0 ${
                  tenant.orderApprovalMode === 'MANUAL' ? 'text-blue-600' : 'text-gray-300'
                }`}
              />
              <div>
                <p className="text-sm font-semibold text-gray-900">Manual</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  El pedido queda pendiente hasta que un operador lo aprueba o lo rechaza desde el detalle del pedido.
                </p>
              </div>
            </button>
          </div>
        </div>
      </div>

      <div className="space-y-5">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-base font-bold text-gray-900 mb-1 flex items-center gap-2">
            <Truck className="w-4 h-4 text-gray-400" /> Formas de entrega configuradas
          </h3>
          <p className="text-sm text-gray-500 mb-4">
            Estas son las opciones de entrega activas en tu tienda. Para editarlas, ve a Ecommerce → Entrega.
          </p>

          {store && store.fulfillmentOptions.length > 0 ? (
            <div className="space-y-2 mb-4">
              {store.fulfillmentOptions.map((option) => (
                <div
                  key={option}
                  className="flex items-center gap-2 text-sm text-gray-700 bg-gray-50 rounded-lg px-3 py-2"
                >
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  {FULFILLMENT_LABELS[option]}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400 mb-4">Aún no configuraste ninguna forma de entrega.</p>
          )}

          <p className="text-xs text-gray-400">Para editarlas, ve a la pestaña "Ecommerce" → Entrega.</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-base font-bold text-gray-900 mb-1">Gestión de pedidos</h3>
          <p className="text-sm text-gray-500 mb-4">
            Revisa, aprueba/rechaza, asigna comanda o guía, y da seguimiento a la entrega de cada pedido.
          </p>
          <a
            href="/dashboard/orders"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:underline"
          >
            Ver todos los pedidos <ArrowRight className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>
    </div>
  );
}
