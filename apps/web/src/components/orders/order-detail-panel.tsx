'use client';

import { useEffect, useState } from 'react';
import { X, Package, Clock, Truck, MapPin, Hash } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/lib/toast-context';
import { apiGet, apiPost, apiPatch } from '@/lib/api-client';
import { Modal } from '@/components/ui/modal';
import type { Order, OrderStatus, OrderStatusHistoryEntry, FulfillmentType } from '@/lib/types';

const STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING: 'Pendiente',
  CONFIRMED: 'Confirmado',
  PREPARING: 'En preparación',
  READY: 'Listo',
  DELIVERED: 'Entregado',
  CANCELLED: 'Cancelado',
};

const STATUS_COLORS: Record<OrderStatus, string> = {
  PENDING: 'bg-amber-50 text-amber-700',
  CONFIRMED: 'bg-blue-50 text-blue-700',
  PREPARING: 'bg-purple-50 text-purple-700',
  READY: 'bg-cyan-50 text-cyan-700',
  DELIVERED: 'bg-emerald-50 text-emerald-700',
  CANCELLED: 'bg-gray-100 text-gray-500',
};

// Mirrors the backend's transition graph (apps/api/.../orders.service.ts) so
// the UI only ever offers legal next steps.
const NEXT_STEPS: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ['CONFIRMED'],
  CONFIRMED: ['PREPARING'],
  PREPARING: ['READY'],
  READY: ['DELIVERED'],
  DELIVERED: [],
  CANCELLED: [],
};

const FULFILLMENT_LABELS: Record<FulfillmentType, string> = {
  PICKUP: 'Retiro en sucursal',
  LOCAL_DELIVERY: 'Entrega a domicilio',
  SHIPPING: 'Envío',
};

// Phase 18: Manual fulfillment
const FULFILLMENT_STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pendiente',
  READY: 'Listo',
  COMPLETED: 'Completado',
  CANCELLED: 'Cancelado',
};

export function OrderDetailPanel({
  orderId,
  onClose,
  onChanged,
}: {
  orderId: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { tokens } = useAuth();
  const toast = useToast();
  const [order, setOrder] = useState<Order | null>(null);
  const [history, setHistory] = useState<OrderStatusHistoryEntry[]>([]);
  const [busy, setBusy] = useState(false);
  const [showDeliveryModal, setShowDeliveryModal] = useState(false);
  const [receivedByName, setReceivedByName] = useState('');
  const [deliveryNote, setDeliveryNote] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [trackingCode, setTrackingCode] = useState('');

  const refetch = async () => {
    const [orderData, historyData] = await Promise.all([
      apiGet<Order>(`/orders/${orderId}`, tokens?.accessToken),
      apiGet<OrderStatusHistoryEntry[]>(`/orders/${orderId}/status-history`, tokens?.accessToken),
    ]);
    setOrder(orderData);
    setHistory(historyData);
  };

  useEffect(() => {
    refetch().catch((err) => console.error('Error fetching order:', err));
  }, [orderId, tokens]);

  useEffect(() => {
    setScheduledAt(order?.fulfillment?.scheduledAt ? order.fulfillment.scheduledAt.slice(0, 16) : '');
  }, [order?.fulfillment?.scheduledAt]);

  useEffect(() => {
    setTrackingCode(order?.trackingCode ?? '');
  }, [order?.trackingCode]);

  const advance = async (status: OrderStatus, extra?: Record<string, any>) => {
    setBusy(true);
    try {
      await apiPost(`/orders/${orderId}/status`, tokens?.accessToken, { status, ...extra });
      await refetch();
      onChanged();
      toast.success('Estado del pedido actualizado correctamente');
    } catch (err: any) {
      toast.error(err.message ?? 'Error al cambiar el estado');
    } finally {
      setBusy(false);
    }
  };

  const openDeliveryModal = () => {
    setReceivedByName('');
    setDeliveryNote('');
    setShowDeliveryModal(true);
  };

  const confirmDelivery = async () => {
    setShowDeliveryModal(false);
    await advance('DELIVERED', {
      receivedByName: receivedByName || undefined,
      note: deliveryNote || undefined,
    });
  };

  const saveScheduledAt = async () => {
    if (!order) return;
    setBusy(true);
    try {
      await apiPost(`/orders/${orderId}/fulfillment`, tokens?.accessToken, {
        fulfillmentType: order.fulfillmentType,
        addressId: order.addressId ?? undefined,
        scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : undefined,
      });
      await refetch();
      toast.success('Entrega/retiro programado correctamente');
    } catch (err: any) {
      toast.error(err.message ?? 'Error al programar la entrega/retiro');
    } finally {
      setBusy(false);
    }
  };

  const saveTrackingCode = async () => {
    if (!order) return;
    setBusy(true);
    try {
      await apiPatch(`/orders/${orderId}/tracking-code`, tokens?.accessToken, { trackingCode });
      await refetch();
      toast.success('Comanda/guía guardada correctamente');
    } catch (err: any) {
      toast.error(err.message ?? 'Error al guardar la comanda/guía');
    } finally {
      setBusy(false);
    }
  };

  const cancel = async () => {
    if (!confirm('¿Cancelar este pedido?')) return;
    setBusy(true);
    try {
      await apiPost(`/orders/${orderId}/cancel`, tokens?.accessToken, {});
      await refetch();
      onChanged();
      toast.success('Pedido cancelado correctamente');
    } catch (err: any) {
      toast.error(err.message ?? 'Error al cancelar el pedido');
    } finally {
      setBusy(false);
    }
  };

  if (!order) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-8 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full" />
      </div>
    );
  }

  const nextSteps = NEXT_STEPS[order.status];
  const canCancel = order.status !== 'DELIVERED' && order.status !== 'CANCELLED';

  return (
    <div className="bg-white rounded-xl border border-gray-200 flex flex-col overflow-hidden max-h-[calc(100vh-8rem)]">
      <div className="flex items-center justify-between p-5 border-b border-gray-100">
        <div>
          <p className="text-base font-bold text-gray-900">{order.orderNumber}</p>
          <p className="text-xs text-gray-400">{order.contact.name}</p>
        </div>
        <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 text-gray-400 transition shrink-0">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-6">
        <div className="flex items-center justify-between">
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${STATUS_COLORS[order.status]}`}>
            {STATUS_LABELS[order.status]}
          </span>
          <p className="text-lg font-bold text-gray-900">
            {order.currency} {order.total.toFixed(2)}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {nextSteps.map((step) => (
            <button
              key={step}
              onClick={() => (step === 'DELIVERED' ? openDeliveryModal() : advance(step))}
              disabled={busy}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm font-semibold"
            >
              {order.status === 'PENDING' && step === 'CONFIRMED'
                ? 'Aprobar pedido'
                : `Marcar como ${STATUS_LABELS[step].toLowerCase()}`}
            </button>
          ))}
          {canCancel && (
            <button
              onClick={cancel}
              disabled={busy}
              className="px-4 py-2 border border-gray-300 disabled:opacity-50 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              {order.status === 'PENDING' ? 'Rechazar pedido' : 'Cancelar pedido'}
            </button>
          )}
        </div>

        <div>
          <h4 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
            <Package className="w-4 h-4 text-gray-400" /> Artículos
          </h4>
          <div className="space-y-2">
            {order.items.map((item) => (
              <div key={item.id} className="flex items-center justify-between text-sm border-b border-gray-50 pb-2">
                <div>
                  <p className="font-medium text-gray-900">{item.productNameSnapshot}</p>
                  <p className="text-xs text-gray-400">{item.skuSnapshot} · x{item.quantity}</p>
                </div>
                <p className="font-semibold text-gray-900">
                  {order.currency} {item.subtotal.toFixed(2)}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h4 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
            <Truck className="w-4 h-4 text-gray-400" /> Entrega
          </h4>
          <div className="text-sm space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-gray-700">{FULFILLMENT_LABELS[order.fulfillmentType]}</p>
              {order.fulfillment && (
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                  {FULFILLMENT_STATUS_LABELS[order.fulfillment.status]}
                </span>
              )}
            </div>
            {order.address && (
              <p className="text-xs text-gray-500">
                {order.address.addressLine}
                {order.address.city ? `, ${order.address.city}` : ''} · {order.address.recipientName}
              </p>
            )}

            {order.fulfillment && order.status !== 'DELIVERED' && order.status !== 'CANCELLED' && (
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={(e) => setScheduledAt(e.target.value)}
                  className="flex-1 px-2 py-1.5 border border-gray-200 rounded-lg text-xs"
                />
                <button
                  onClick={saveScheduledAt}
                  disabled={busy}
                  className="px-3 py-1.5 border border-gray-300 rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 shrink-0"
                >
                  Programar
                </button>
              </div>
            )}

            {order.fulfillment?.status === 'COMPLETED' && (
              <div className="text-xs text-gray-500 bg-gray-50 rounded-lg p-2 space-y-0.5">
                {order.fulfillment.receivedByName && (
                  <p>
                    {order.fulfillmentType === 'PICKUP' ? 'Recogido por' : 'Recibido por'}: {order.fulfillment.receivedByName}
                  </p>
                )}
                {order.fulfillment.note && <p>Nota: {order.fulfillment.note}</p>}
                {order.fulfillment.completedAt && (
                  <p>Completado: {new Date(order.fulfillment.completedAt).toLocaleString()}</p>
                )}
              </div>
            )}
          </div>
        </div>

        <div>
          <h4 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
            <Hash className="w-4 h-4 text-gray-400" /> Comanda / guía
          </h4>
          <div className="flex items-center gap-2">
            <input
              value={trackingCode}
              onChange={(e) => setTrackingCode(e.target.value)}
              placeholder="Ej: GUIA-0001"
              className="flex-1 px-3 py-1.5 border border-gray-200 rounded-lg text-sm"
            />
            <button
              onClick={saveTrackingCode}
              disabled={busy}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 shrink-0"
            >
              Guardar
            </button>
          </div>
        </div>

        <div>
          <h4 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
            <MapPin className="w-4 h-4 text-gray-400" /> Ubicación del cliente
          </h4>
          {order.customerLocation ? (
            <div className="text-sm space-y-1">
              <p className="text-gray-700">
                {order.customerLocation.address ?? `${order.customerLocation.latitude}, ${order.customerLocation.longitude}`}
              </p>
              <a
                href={`https://www.google.com/maps?q=${order.customerLocation.latitude},${order.customerLocation.longitude}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-medium text-blue-600 hover:underline"
              >
                Ver en mapa
              </a>
            </div>
          ) : (
            <p className="text-sm text-gray-400">El cliente no compartió su ubicación.</p>
          )}
        </div>

        <div>
          <h4 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
            <Clock className="w-4 h-4 text-gray-400" /> Historial de estado
          </h4>
          <div className="space-y-3">
            {history.map((entry) => (
              <div key={entry.id} className="flex items-start justify-between text-sm">
                <div>
                  <p className="text-gray-900 font-medium">
                    {entry.fromStatus ? `${STATUS_LABELS[entry.fromStatus]} → ` : ''}
                    {STATUS_LABELS[entry.toStatus]}
                  </p>
                  {entry.note && <p className="text-xs text-gray-500">{entry.note}</p>}
                </div>
                <p className="text-xs text-gray-400 shrink-0">{new Date(entry.createdAt).toLocaleString()}</p>
              </div>
            ))}
            {history.length === 0 && <p className="text-sm text-gray-400">Sin cambios de estado todavía.</p>}
          </div>
        </div>
      </div>

      <Modal open={showDeliveryModal} onClose={() => setShowDeliveryModal(false)} title="Registrar entrega/retiro">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1.5">Recibido por (opcional)</label>
            <input
              value={receivedByName}
              onChange={(e) => setReceivedByName(e.target.value)}
              placeholder="Nombre de quien recibe"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1.5">Nota (opcional)</label>
            <textarea
              value={deliveryNote}
              onChange={(e) => setDeliveryNote(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button
            onClick={() => setShowDeliveryModal(false)}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-900 hover:bg-gray-50 font-medium text-sm"
          >
            Cancelar
          </button>
          <button onClick={confirmDelivery} className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold text-sm">
            Confirmar
          </button>
        </div>
      </Modal>
    </div>
  );
}
