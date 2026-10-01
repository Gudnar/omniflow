'use client';

import { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { apiGet } from '@/lib/api-client';
import type { FlowExecution, FlowExecutionStatus } from '@/lib/types';

const STATUS_LABELS: Record<FlowExecutionStatus, string> = {
  RUNNING: 'En curso',
  WAITING: 'Esperando',
  COMPLETED: 'Completado',
  FAILED: 'Fallido',
  CANCELLED: 'Cancelado',
};

const STATUS_COLORS: Record<FlowExecutionStatus, string> = {
  RUNNING: 'bg-blue-50 text-blue-700',
  WAITING: 'bg-amber-50 text-amber-700',
  COMPLETED: 'bg-emerald-50 text-emerald-700',
  FAILED: 'bg-red-50 text-red-600',
  CANCELLED: 'bg-gray-100 text-gray-500',
};

export function ExecutionsPanel({ flowId }: { flowId: string }) {
  const { tokens } = useAuth();
  const [executions, setExecutions] = useState<FlowExecution[]>([]);
  const [selected, setSelected] = useState<FlowExecution | null>(null);
  const [loading, setLoading] = useState(true);

  const refetch = () =>
    apiGet<FlowExecution[]>(`/workflows/flows/${flowId}/executions`, tokens?.accessToken).then(setExecutions);

  useEffect(() => {
    if (!tokens) return;
    refetch()
      .catch((err) => console.error('Error fetching executions:', err))
      .finally(() => setLoading(false));
    const interval = setInterval(() => refetch().catch(() => {}), 4000);
    return () => clearInterval(interval);
  }, [tokens, flowId]);

  const openDetail = async (id: string) => {
    const execution = await apiGet<FlowExecution>(`/workflows/executions/${id}`, tokens?.accessToken);
    setSelected(execution);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[30vh]">
        <div className="animate-spin w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full" />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[1fr_420px] gap-4 items-start">
      <div className="bg-white rounded-xl border border-gray-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-left text-xs font-semibold text-gray-500">
              <th className="px-4 py-3">Disparado por</th>
              <th className="px-3 py-3">Estado</th>
              <th className="px-3 py-3">Inicio</th>
              <th className="px-3 py-3">Fin</th>
            </tr>
          </thead>
          <tbody>
            {executions.map((ex) => (
              <tr
                key={ex.id}
                onClick={() => openDetail(ex.id)}
                className={`border-b border-gray-50 cursor-pointer transition ${
                  selected?.id === ex.id ? 'bg-blue-50' : 'hover:bg-gray-50'
                }`}
              >
                <td className="px-4 py-3 font-medium text-gray-900">{ex.triggerEventType ?? '—'}</td>
                <td className="px-3 py-3">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_COLORS[ex.status]}`}>
                    {STATUS_LABELS[ex.status]}
                  </span>
                </td>
                <td className="px-3 py-3 text-gray-500 whitespace-nowrap">{new Date(ex.startedAt).toLocaleString()}</td>
                <td className="px-3 py-3 text-gray-400 whitespace-nowrap">
                  {ex.finishedAt ? new Date(ex.finishedAt).toLocaleString() : '—'}
                </td>
              </tr>
            ))}
            {executions.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-sm text-gray-400">
                  Sin ejecuciones todavía.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {selected && (
        <div className="sticky top-6 bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${STATUS_COLORS[selected.status]}`}>
              {STATUS_LABELS[selected.status]}
            </span>
            <span className="text-xs text-gray-400">{new Date(selected.startedAt).toLocaleString()}</span>
          </div>

          {selected.errorMessage && (
            <p className="text-xs text-red-600 bg-red-50 rounded-lg p-2">{selected.errorMessage}</p>
          )}

          <div>
            <h4 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
              <Clock className="w-4 h-4 text-gray-400" /> Registro de ejecución
            </h4>
            <div className="space-y-3">
              {(selected.logs ?? []).map((log) => (
                <div key={log.id} className="text-sm border-b border-gray-50 pb-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-gray-900">{log.nodeId.slice(0, 8)}…</span>
                    <span
                      className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                        log.status === 'SUCCESS' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'
                      }`}
                    >
                      {log.status}
                    </span>
                  </div>
                  {log.error && <p className="text-xs text-red-500 mt-1">{log.error}</p>}
                </div>
              ))}
              {(selected.logs ?? []).length === 0 && <p className="text-sm text-gray-400">Sin pasos registrados.</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
