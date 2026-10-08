'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { apiGet } from '@/lib/api-client';
import type { Order } from '@/lib/types';
import { OrdersTable } from '@/components/orders/orders-table';
import { OrderDetailPanel } from '@/components/orders/order-detail-panel';
import { DeliveryRoutesTab } from '@/components/orders/delivery-routes-tab';
import { Modal } from '@/components/ui/modal';

const TABS = ['Todos', 'Ventas', 'Reservas', 'Pendientes', 'Preparación', 'Entrega', 'Rutas del día', 'Historial'] as const;
type Tab = (typeof TABS)[number];

export default function OrdersPage() {
  const router = useRouter();
  const { user, tokens, isLoading } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('Todos');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const refetch = () => apiGet<Order[]>('/orders', tokens?.accessToken).then(setOrders);

  useEffect(() => {
    if (!isLoading && !user) router.push('/login');
  }, [isLoading, user, router]);

  useEffect(() => {
    if (!user || !tokens) return;
    refetch()
      .catch((err) => console.error('Error fetching orders:', err))
      .finally(() => setDataLoading(false));
  }, [user, tokens]);

  const filtered = useMemo(() => {
    switch (tab) {
      case 'Todos':
      case 'Ventas':
        return orders;
      case 'Pendientes':
        return orders.filter((o) => o.status === 'PENDING');
      case 'Preparación':
        return orders.filter((o) => o.status === 'CONFIRMED' || o.status === 'PREPARING');
      case 'Entrega':
        return orders.filter((o) => o.status === 'READY');
      case 'Historial':
        return orders.filter((o) => o.status === 'DELIVERED' || o.status === 'CANCELLED');
      default:
        return [];
    }
  }, [orders, tab]);

  if (isLoading || dataLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full" />
      </div>
    );
  }

  return (
    <div className="max-w-[1800px] mx-auto px-4 sm:px-6 py-6 space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Pedidos</h1>
        <p className="text-sm text-gray-500 mt-0.5">Gestiona el ciclo de vida de los pedidos de tu tienda.</p>
      </div>

      <div className="flex items-center gap-2 border-b border-gray-200 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-2.5 text-sm font-medium border-b-2 whitespace-nowrap transition ${
              tab === t ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'Reservas' && (
        <p className="text-sm text-gray-400 text-center py-12">Disponible en la Fase 12 (Reservas).</p>
      )}
      {tab === 'Rutas del día' && <DeliveryRoutesTab />}

      {tab !== 'Reservas' && tab !== 'Rutas del día' && (
        <OrdersTable orders={filtered} selectedId={selectedId} onSelect={setSelectedId} />
      )}

      <Modal open={!!selectedId} onClose={() => setSelectedId(null)} size="lg">
        {selectedId && (
          <OrderDetailPanel orderId={selectedId} onClose={() => setSelectedId(null)} onChanged={refetch} />
        )}
      </Modal>
    </div>
  );
}
