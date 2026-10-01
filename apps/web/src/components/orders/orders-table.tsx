'use client';

import type { Order, OrderStatus } from '@/lib/types';

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

const FULFILLMENT_LABELS: Record<string, string> = {
  PICKUP: 'Retiro',
  LOCAL_DELIVERY: 'Entrega',
  SHIPPING: 'Envío',
};

export function OrdersTable({
  orders,
  selectedId,
  onSelect,
}: {
  orders: Order[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 flex flex-col">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-left text-xs font-semibold text-gray-500">
              <th className="px-4 py-3">Pedido</th>
              <th className="px-3 py-3">Contacto</th>
              <th className="px-3 py-3">Sucursal</th>
              <th className="px-3 py-3">Entrega</th>
              <th className="px-3 py-3">Total</th>
              <th className="px-3 py-3">Estado</th>
              <th className="px-3 py-3">Fecha</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <tr
                key={order.id}
                onClick={() => onSelect(order.id)}
                className={`border-b border-gray-50 cursor-pointer transition ${
                  selectedId === order.id ? 'bg-blue-50' : 'hover:bg-gray-50'
                }`}
              >
                <td className="px-4 py-3 font-semibold text-gray-900">{order.orderNumber}</td>
                <td className="px-3 py-3 text-gray-600">{order.contact.name}</td>
                <td className="px-3 py-3 text-gray-600">{order.branch?.name ?? '—'}</td>
                <td className="px-3 py-3 text-gray-600">{FULFILLMENT_LABELS[order.fulfillmentType]}</td>
                <td className="px-3 py-3 font-medium text-gray-900">
                  {order.currency} {order.total.toFixed(2)}
                </td>
                <td className="px-3 py-3">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_COLORS[order.status]}`}>
                    {STATUS_LABELS[order.status]}
                  </span>
                </td>
                <td className="px-3 py-3 text-gray-500 whitespace-nowrap">
                  {new Date(order.createdAt).toLocaleDateString()}
                </td>
              </tr>
            ))}
            {orders.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-sm text-gray-400">
                  Sin pedidos en esta vista.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="p-4">
        <p className="text-sm text-gray-500">Mostrando {orders.length} pedidos</p>
      </div>
    </div>
  );
}
