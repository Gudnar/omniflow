'use client';

import type { OrderStatus } from '@/lib/types';

// Forward progress only — CANCELLED is a terminal exit, not a funnel stage,
// so it's reported separately rather than breaking the funnel shape.
const STAGE_ORDER: OrderStatus[] = ['PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'DELIVERED'];

const STAGE_LABELS: Record<OrderStatus, string> = {
  PENDING: 'Pendientes',
  CONFIRMED: 'Confirmados',
  PREPARING: 'En preparación',
  READY: 'Listos',
  DELIVERED: 'Entregados',
  CANCELLED: 'Cancelados',
};

const STAGE_COLORS: Record<OrderStatus, string> = {
  PENDING: '#1e3a8a',
  CONFIRMED: '#2563eb',
  PREPARING: '#f59e0b',
  READY: '#16a34a',
  DELIVERED: '#ec4899',
  CANCELLED: '#9ca3af',
};

export function SalesFunnel({ data }: { data: { status: OrderStatus; count: number }[] }) {
  const countByStatus = new Map(data.map((d) => [d.status, d.count]));
  const stages = STAGE_ORDER.map((status) => ({ status, count: countByStatus.get(status) ?? 0 }));
  const cancelled = countByStatus.get('CANCELLED') ?? 0;
  const maxCount = Math.max(1, ...stages.map((s) => s.count));
  const hasAny = stages.some((s) => s.count > 0) || cancelled > 0;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 h-full">
      <h3 className="font-semibold text-gray-900 mb-4">Pedidos por Estado</h3>
      {!hasAny ? (
        <p className="text-sm text-gray-400 py-10 text-center">Todavía no hay pedidos.</p>
      ) : (
        <>
          <div className="flex gap-4">
            <div className="flex-1 flex flex-col items-center gap-1 py-1">
              {stages.map((s) => (
                <div
                  key={s.status}
                  className="h-9 flex items-center justify-center text-white text-xs font-semibold rounded-sm"
                  style={{ backgroundColor: STAGE_COLORS[s.status], width: `${Math.max(12, (s.count / maxCount) * 100)}%` }}
                >
                  {s.count.toLocaleString('es-BO')}
                </div>
              ))}
            </div>
            <div className="flex flex-col gap-1 py-1 shrink-0">
              {stages.map((s) => (
                <div key={s.status} className="h-9 flex flex-col justify-center">
                  <p className="text-sm font-medium text-gray-800 leading-tight">{STAGE_LABELS[s.status]}</p>
                </div>
              ))}
            </div>
          </div>
          {cancelled > 0 && <p className="text-xs text-gray-400 mt-3">{cancelled} pedido(s) cancelado(s) en total.</p>}
        </>
      )}
    </div>
  );
}
