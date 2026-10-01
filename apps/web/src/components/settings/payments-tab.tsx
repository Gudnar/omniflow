'use client';

import { useEffect, useState } from 'react';
import { Plus, Trash2, Banknote, Landmark, QrCode, Pencil } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/lib/toast-context';
import { apiGet, apiPost, apiPatch, apiDelete } from '@/lib/api-client';
import { Modal } from '@/components/ui/modal';
import { ImageUploadField } from '@/components/settings/ecommerce/image-upload-field';
import type { PaymentMethod, PaymentMethodType } from '@/lib/types';

const TYPE_LABELS: Record<PaymentMethodType, string> = {
  CASH: 'Efectivo',
  BANK_TRANSFER: 'Transferencia bancaria',
  QR: 'Código QR',
};

const TYPE_ICONS: Record<PaymentMethodType, typeof Banknote> = {
  CASH: Banknote,
  BANK_TRANSFER: Landmark,
  QR: QrCode,
};

function emptyForm(): {
  id: string | null;
  type: PaymentMethodType;
  label: string;
  instructions: string;
  qrImageUrl: string;
  enabled: boolean;
} {
  return { id: null, type: 'CASH', label: '', instructions: '', qrImageUrl: '', enabled: true };
}

export function PaymentsTab() {
  const { tokens } = useAuth();
  const toast = useToast();
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm());

  const refetch = () => apiGet<PaymentMethod[]>('/payment-methods', tokens?.accessToken).then(setMethods);

  useEffect(() => {
    if (!tokens) return;
    refetch()
      .catch((err) => console.error('Error fetching payment methods:', err))
      .finally(() => setLoading(false));
  }, [tokens]);

  const openCreate = () => {
    setForm(emptyForm());
    setShowModal(true);
  };

  const openEdit = (method: PaymentMethod) => {
    setForm({
      id: method.id,
      type: method.type,
      label: method.label,
      instructions: method.instructions ?? '',
      qrImageUrl: method.qrImageUrl ?? '',
      enabled: method.enabled,
    });
    setShowModal(true);
  };

  const save = async () => {
    if (!form.label.trim()) {
      toast.error('El nombre del método es obligatorio');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        type: form.type,
        label: form.label,
        instructions: form.instructions || undefined,
        qrImageUrl: form.type === 'QR' ? form.qrImageUrl || undefined : undefined,
        enabled: form.enabled,
      };
      if (form.id) {
        await apiPatch(`/payment-methods/${form.id}`, tokens?.accessToken, payload);
      } else {
        await apiPost('/payment-methods', tokens?.accessToken, payload);
      }
      await refetch();
      setShowModal(false);
      toast.success('Método de pago guardado correctamente');
    } catch (err: any) {
      toast.error(err.message ?? 'Error al guardar el método de pago');
    } finally {
      setSaving(false);
    }
  };

  const toggleEnabled = async (method: PaymentMethod) => {
    try {
      await apiPatch(`/payment-methods/${method.id}`, tokens?.accessToken, { enabled: !method.enabled });
      await refetch();
    } catch (err: any) {
      toast.error(err.message ?? 'Error al actualizar el método de pago');
    }
  };

  const remove = async (method: PaymentMethod) => {
    if (!confirm(`¿Eliminar "${method.label}"?`)) return;
    try {
      await apiDelete(`/payment-methods/${method.id}`, tokens?.accessToken);
      await refetch();
      toast.success('Método de pago eliminado correctamente');
    } catch (err: any) {
      toast.error(err.message ?? 'Error al eliminar el método de pago');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="animate-spin w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-base font-bold text-gray-900">Métodos de pago</h3>
            <p className="text-sm text-gray-500 mt-0.5">
              Lo que el checkout y el agente de IA muestran al cliente para pagar: efectivo contra entrega,
              transferencia bancaria o un código QR. No hay ninguna pasarela de pago automática conectada — para eso
              ve a Integraciones → Pasarelas de pago.
            </p>
          </div>
          <button
            onClick={openCreate}
            className="shrink-0 inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold"
          >
            <Plus className="w-4 h-4" /> Agregar método
          </button>
        </div>

        {methods.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">Aún no configuraste ningún método de pago.</p>
        ) : (
          <div className="space-y-2">
            {methods.map((method) => {
              const Icon = TYPE_ICONS[method.type];
              return (
                <div
                  key={method.id}
                  className="flex items-center gap-3 border border-gray-100 rounded-lg p-3 hover:bg-gray-50"
                >
                  <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                    <Icon className="w-4 h-4 text-gray-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{method.label}</p>
                    <p className="text-xs text-gray-400">{TYPE_LABELS[method.type]}</p>
                  </div>
                  <label className="flex items-center gap-1.5 text-xs text-gray-500 shrink-0">
                    <input type="checkbox" checked={method.enabled} onChange={() => toggleEnabled(method)} />
                    Activo
                  </label>
                  <button
                    onClick={() => openEdit(method)}
                    className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 shrink-0"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => remove(method)}
                    className="p-2 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Modal open={showModal} onClose={() => setShowModal(false)} title={form.id ? 'Editar método de pago' : 'Nuevo método de pago'}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1.5">Tipo</label>
            <select
              value={form.type}
              onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as PaymentMethodType }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
            >
              {(Object.keys(TYPE_LABELS) as PaymentMethodType[]).map((t) => (
                <option key={t} value={t}>{TYPE_LABELS[t]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1.5">Nombre</label>
            <input
              value={form.label}
              onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
              placeholder="Ej: Transferencia BCP, QR Simple, Efectivo contra entrega"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1.5">
              {form.type === 'CASH' ? 'Instrucciones (opcional)' : 'Datos de la cuenta'}
            </label>
            <textarea
              value={form.instructions}
              onChange={(e) => setForm((f) => ({ ...f, instructions: e.target.value }))}
              rows={3}
              placeholder={
                form.type === 'BANK_TRANSFER'
                  ? 'Banco, número de cuenta, titular...'
                  : form.type === 'QR'
                    ? 'Nombre del titular del QR, banco emisor...'
                    : 'Ej: Se paga al momento de recibir el pedido'
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>
          {form.type === 'QR' && (
            <ImageUploadField
              label="Imagen del QR"
              value={form.qrImageUrl}
              onChange={(url) => setForm((f) => ({ ...f, qrImageUrl: url }))}
              token={tokens?.accessToken}
              endpoint="/payment-methods/qr-image"
            />
          )}
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={form.enabled}
              onChange={(e) => setForm((f) => ({ ...f, enabled: e.target.checked }))}
            />
            Método activo (visible para el cliente)
          </label>
        </div>
        <div className="flex gap-3 mt-6">
          <button
            onClick={() => setShowModal(false)}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-900 hover:bg-gray-50 font-medium text-sm"
          >
            Cancelar
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg font-semibold text-sm"
          >
            Guardar
          </button>
        </div>
      </Modal>
    </div>
  );
}
