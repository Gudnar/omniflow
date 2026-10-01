'use client';

import { useEffect, useState } from 'react';
import { Plus, Trash2, ArrowRight } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/lib/toast-context';
import { apiGet, apiPost } from '@/lib/api-client';
import type { InventoryTransfer } from '@/lib/types';
import { Modal } from '@/components/ui/modal';

interface Branch {
  id: string;
  name: string;
}

interface VariantOption {
  id: string;
  sku: string;
  name: string | null;
  productName: string;
}

const STATUS_LABELS: Record<string, string> = { PENDING: 'Pendiente', COMPLETED: 'Completado', CANCELLED: 'Cancelado' };
const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-amber-50 text-amber-700',
  COMPLETED: 'bg-emerald-50 text-emerald-700',
  CANCELLED: 'bg-gray-100 text-gray-500',
};

export function TransfersTab() {
  const { tokens } = useAuth();
  const toast = useToast();
  const [transfers, setTransfers] = useState<InventoryTransfer[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [variants, setVariants] = useState<VariantOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [fromBranchId, setFromBranchId] = useState('');
  const [toBranchId, setToBranchId] = useState('');
  const [items, setItems] = useState<{ variantId: string; quantity: number }[]>([{ variantId: '', quantity: 1 }]);
  const [note, setNote] = useState('');

  const refetch = () => apiGet<InventoryTransfer[]>('/inventory-transfers', tokens?.accessToken).then(setTransfers);

  useEffect(() => {
    if (!tokens) return;
    Promise.all([
      refetch(),
      apiGet<Branch[]>('/branches', tokens.accessToken),
      apiGet<any[]>('/products', tokens.accessToken).then((products) =>
        products.flatMap((p) => p.variants.map((v: any) => ({ id: v.id, sku: v.sku, name: v.name, productName: p.name }))),
      ),
    ])
      .then(([, branchesData, variantsData]) => {
        setBranches(branchesData);
        setVariants(variantsData);
      })
      .catch((err) => console.error('Error fetching transfers:', err))
      .finally(() => setLoading(false));
  }, [tokens]);

  const openCreate = () => {
    setFromBranchId('');
    setToBranchId('');
    setItems([{ variantId: '', quantity: 1 }]);
    setNote('');
    setShowModal(true);
  };

  const create = async () => {
    try {
      await apiPost('/inventory-transfers', tokens?.accessToken, {
        fromBranchId,
        toBranchId,
        items: items.filter((i) => i.variantId),
        note: note || undefined,
      });
      await refetch();
      setShowModal(false);
      toast.success('Traspaso creado correctamente');
    } catch (err: any) {
      toast.error(err.message ?? 'No se pudo crear el traspaso');
    }
  };

  const complete = async (id: string) => {
    try {
      await apiPost(`/inventory-transfers/${id}/complete`, tokens?.accessToken, {});
      await refetch();
      toast.success('Traspaso completado correctamente');
    } catch (err: any) {
      toast.error(err.message ?? 'No se pudo completar el traspaso');
    }
  };

  const cancel = async (id: string) => {
    if (!confirm('¿Cancelar este traspaso?')) return;
    try {
      await apiPost(`/inventory-transfers/${id}/cancel`, tokens?.accessToken, {});
      await refetch();
      toast.success('Traspaso cancelado correctamente');
    } catch (err: any) {
      toast.error(err.message ?? 'No se pudo cancelar el traspaso');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[30vh]">
        <div className="animate-spin w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full" />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200">
      <div className="flex items-center justify-between p-5 border-b border-gray-100">
        <h3 className="text-base font-bold text-gray-900">Traspasos entre sucursales</h3>
        <button
          onClick={openCreate}
          className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-semibold text-white transition"
        >
          <Plus className="w-4 h-4" />
          Nuevo traspaso
        </button>
      </div>

      <div className="divide-y divide-gray-50">
        {transfers.map((t) => (
          <div key={t.id} className="flex items-center gap-4 p-5 flex-wrap">
            <div className="flex items-center gap-2 text-sm font-medium text-gray-900 min-w-[240px]">
              {t.fromBranch.name}
              <ArrowRight className="w-4 h-4 text-gray-400" />
              {t.toBranch.name}
            </div>
            <div className="text-xs text-gray-500 flex-1 min-w-[160px]">
              {t.items.length} {t.items.length === 1 ? 'artículo' : 'artículos'} ·{' '}
              {new Date(t.createdAt).toLocaleDateString()}
            </div>
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full shrink-0 ${STATUS_COLORS[t.status]}`}>
              {STATUS_LABELS[t.status]}
            </span>
            {t.status === 'PENDING' && (
              <div className="flex gap-2 shrink-0">
                <button
                  onClick={() => complete(t.id)}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold"
                >
                  Completar
                </button>
                <button
                  onClick={() => cancel(t.id)}
                  className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-50"
                >
                  Cancelar
                </button>
              </div>
            )}
          </div>
        ))}
        {transfers.length === 0 && <p className="p-8 text-center text-sm text-gray-400">Sin traspasos todavía.</p>}
      </div>

      <Modal open={showModal} onClose={() => setShowModal(false)} title="Nuevo traspaso">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-1.5">Desde</label>
              <select
                value={fromBranchId}
                onChange={(e) => setFromBranchId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
              >
                <option value="">—</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-1.5">Hacia</label>
              <select
                value={toBranchId}
                onChange={(e) => setToBranchId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
              >
                <option value="">—</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1.5">Artículos</label>
            <div className="space-y-2">
              {items.map((item, i) => (
                <div key={i} className="flex items-center gap-2">
                  <select
                    value={item.variantId}
                    onChange={(e) => {
                      const next = [...items];
                      next[i] = { ...next[i], variantId: e.target.value };
                      setItems(next);
                    }}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                  >
                    <option value="">Selecciona una variante</option>
                    {variants.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.productName} {v.name ? `- ${v.name}` : ''} ({v.sku})
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min={1}
                    value={item.quantity}
                    onChange={(e) => {
                      const next = [...items];
                      next[i] = { ...next[i], quantity: Number(e.target.value) };
                      setItems(next);
                    }}
                    className="w-20 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                  <button onClick={() => setItems(items.filter((_, idx) => idx !== i))} className="p-2 text-red-500 hover:bg-red-50 rounded-lg">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
            <button
              onClick={() => setItems([...items, { variantId: '', quantity: 1 }])}
              className="mt-2 text-xs font-medium text-blue-600 hover:text-blue-700"
            >
              + Agregar artículo
            </button>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1.5">Nota</label>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
          <button
            onClick={create}
            disabled={!fromBranchId || !toBranchId || fromBranchId === toBranchId}
            className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg font-semibold text-sm"
          >
            Crear traspaso
          </button>
        </div>
      </Modal>
    </div>
  );
}
