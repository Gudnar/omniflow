'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Workflow as WorkflowIcon } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/lib/toast-context';
import { apiGet, apiPost } from '@/lib/api-client';
import type { Flow, FlowStatus } from '@/lib/types';
import { Modal } from '@/components/ui/modal';

const STATUS_LABELS: Record<FlowStatus, string> = {
  DRAFT: 'Borrador',
  ACTIVE: 'Activo',
  INACTIVE: 'Inactivo',
};

const STATUS_COLORS: Record<FlowStatus, string> = {
  DRAFT: 'bg-gray-100 text-gray-600',
  ACTIVE: 'bg-emerald-50 text-emerald-700',
  INACTIVE: 'bg-amber-50 text-amber-700',
};

export default function FlowsPage() {
  const router = useRouter();
  const { user, isLoading, tokens } = useAuth();
  const toast = useToast();
  const [flows, setFlows] = useState<Flow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: '', description: '' });

  useEffect(() => {
    if (!isLoading && !user) router.push('/login');
  }, [isLoading, user, router]);

  const refetch = () => apiGet<Flow[]>('/workflows/flows', tokens?.accessToken).then(setFlows);

  useEffect(() => {
    if (!tokens) return;
    refetch()
      .catch((err) => console.error('Error fetching flows:', err))
      .finally(() => setLoading(false));
  }, [tokens]);

  const create = async () => {
    if (!form.name.trim()) return;
    try {
      const flow = await apiPost<Flow>('/workflows/flows', tokens?.accessToken, {
        name: form.name,
        description: form.description || undefined,
      });
      router.push(`/dashboard/flows/${flow.id}`);
    } catch (err: any) {
      toast.error(err.message ?? 'Error al crear el flujo');
    }
  };

  if (isLoading || !user || loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full" />
      </div>
    );
  }

  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Flujos (Automatizaciones)</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Triggers, condiciones y acciones automáticas sobre contactos, pedidos y citas.
          </p>
        </div>
        <button
          onClick={() => {
            setForm({ name: '', description: '' });
            setShowModal(true);
          }}
          className="flex items-center gap-1.5 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-semibold text-white transition"
        >
          <Plus className="w-4 h-4" />
          Nuevo flujo
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-left text-xs font-semibold text-gray-500">
              <th className="px-4 py-3">Nombre</th>
              <th className="px-3 py-3">Descripción</th>
              <th className="px-3 py-3">Nodos</th>
              <th className="px-3 py-3">Estado</th>
              <th className="px-3 py-3">Actualizado</th>
            </tr>
          </thead>
          <tbody>
            {flows.map((f) => (
              <tr
                key={f.id}
                onClick={() => router.push(`/dashboard/flows/${f.id}`)}
                className="border-b border-gray-50 cursor-pointer hover:bg-gray-50 transition"
              >
                <td className="px-4 py-3 font-medium text-gray-900 flex items-center gap-2">
                  <WorkflowIcon className="w-4 h-4 text-gray-400" />
                  {f.name}
                </td>
                <td className="px-3 py-3 text-gray-500">{f.description ?? '—'}</td>
                <td className="px-3 py-3 text-gray-600">{f.nodes?.length ?? 0}</td>
                <td className="px-3 py-3">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_COLORS[f.status]}`}>
                    {STATUS_LABELS[f.status]}
                  </span>
                </td>
                <td className="px-3 py-3 text-gray-400 whitespace-nowrap">
                  {new Date(f.updatedAt).toLocaleString()}
                </td>
              </tr>
            ))}
            {flows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-400">
                  Sin flujos todavía.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal open={showModal} onClose={() => setShowModal(false)} title="Nuevo flujo">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1.5">Nombre</label>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1.5">Descripción</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button
            onClick={() => setShowModal(false)}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-900 hover:bg-gray-50 font-medium text-sm"
          >
            Cancelar
          </button>
          <button onClick={create} className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold text-sm">
            Crear y editar
          </button>
        </div>
      </Modal>
    </div>
  );
}
