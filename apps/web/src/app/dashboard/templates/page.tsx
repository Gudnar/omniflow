'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Pencil, Trash2, Send, RefreshCw } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/lib/toast-context';
import { apiGet, apiPost, apiPatch, apiDelete } from '@/lib/api-client';
import type { MessageTemplate, TemplateCategory } from '@/lib/types';
import { Modal } from '@/components/ui/modal';

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Borrador',
  PENDING_APPROVAL: 'En revisión',
  APPROVED: 'Aprobada',
  REJECTED: 'Rechazada',
  DISABLED: 'Deshabilitada',
};

const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-600',
  PENDING_APPROVAL: 'bg-amber-50 text-amber-700',
  APPROVED: 'bg-emerald-50 text-emerald-700',
  REJECTED: 'bg-red-50 text-red-600',
  DISABLED: 'bg-gray-200 text-gray-500',
};

const EMPTY_FORM = {
  name: '',
  category: 'UTILITY' as TemplateCategory,
  language: 'es',
  headerText: '',
  bodyText: '',
  footerText: '',
};

function countPlaceholders(text: string): number {
  const matches = text.match(/\{\{\d+\}\}/g);
  return matches ? new Set(matches).size : 0;
}

export default function TemplatesPage() {
  const router = useRouter();
  const { user, isLoading, tokens } = useAuth();
  const toast = useToast();
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && !user) router.push('/login');
  }, [isLoading, user, router]);

  const refetch = () => apiGet<MessageTemplate[]>('/templates', tokens?.accessToken).then(setTemplates);

  useEffect(() => {
    if (!tokens) return;
    refetch()
      .catch((err) => console.error('Error fetching templates:', err))
      .finally(() => setLoading(false));
  }, [tokens]);

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setShowModal(true);
  };

  const openEdit = (t: MessageTemplate) => {
    setEditingId(t.id);
    setForm({
      name: t.name,
      category: t.category,
      language: t.language,
      headerText: t.headerText ?? '',
      bodyText: t.bodyText,
      footerText: t.footerText ?? '',
    });
    setShowModal(true);
  };

  const save = async () => {
    const payload = {
      ...form,
      headerText: form.headerText || undefined,
      footerText: form.footerText || undefined,
    };
    try {
      if (editingId) {
        const { name, category, language, ...editable } = payload;
        await apiPatch(`/templates/${editingId}`, tokens?.accessToken, editable);
      } else {
        await apiPost('/templates', tokens?.accessToken, payload);
      }
      await refetch();
      setShowModal(false);
      toast.success(editingId ? 'Plantilla actualizada correctamente' : 'Plantilla creada correctamente');
    } catch (err: any) {
      toast.error(err.message ?? 'Error al guardar la plantilla');
    }
  };

  const remove = async (id: string) => {
    if (!confirm('¿Eliminar esta plantilla?')) return;
    try {
      await apiDelete(`/templates/${id}`, tokens?.accessToken);
      await refetch();
      toast.success('Plantilla eliminada correctamente');
    } catch (err: any) {
      toast.error(err.message ?? 'Error al eliminar la plantilla');
    }
  };

  const submit = async (id: string) => {
    setBusyId(id);
    try {
      await apiPost(`/templates/${id}/submit`, tokens?.accessToken, {});
      await refetch();
      toast.success('Plantilla enviada a revisión correctamente');
    } catch (err: any) {
      toast.error(err.message ?? 'Meta rechazó el envío a revisión');
    } finally {
      setBusyId(null);
    }
  };

  const syncStatus = async (id: string) => {
    setBusyId(id);
    try {
      await apiPost(`/templates/${id}/sync-status`, tokens?.accessToken, {});
      await refetch();
      toast.success('Estado sincronizado correctamente');
    } catch (err: any) {
      toast.error(err.message ?? 'Error al sincronizar el estado');
    } finally {
      setBusyId(null);
    }
  };

  if (isLoading || !user || loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full" />
      </div>
    );
  }

  const editable = (t: MessageTemplate) => t.status === 'DRAFT' || t.status === 'REJECTED';

  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Plantillas</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Plantillas de mensaje de WhatsApp Business, sujetas a revisión real de Meta.
          </p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-1.5 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-semibold text-white transition"
        >
          <Plus className="w-4 h-4" />
          Nueva plantilla
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-left text-xs font-semibold text-gray-500">
              <th className="px-4 py-3">Nombre</th>
              <th className="px-3 py-3">Categoría</th>
              <th className="px-3 py-3">Idioma</th>
              <th className="px-3 py-3">Estado</th>
              <th className="px-3 py-3">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {templates.map((t) => (
              <tr key={t.id} className="border-b border-gray-50">
                <td className="px-4 py-3">
                  <p className="font-medium text-gray-900">{t.name}</p>
                  {t.status === 'REJECTED' && t.rejectionReason && (
                    <p className="text-xs text-red-500 mt-0.5">{t.rejectionReason}</p>
                  )}
                </td>
                <td className="px-3 py-3 text-gray-600">{t.category}</td>
                <td className="px-3 py-3 text-gray-600">{t.language}</td>
                <td className="px-3 py-3">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_COLORS[t.status]}`}>
                    {STATUS_LABELS[t.status]}
                  </span>
                </td>
                <td className="px-3 py-3">
                  <div className="flex items-center gap-1.5">
                    {editable(t) && (
                      <>
                        <button onClick={() => openEdit(t)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400" title="Editar">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => submit(t.id)}
                          disabled={busyId === t.id}
                          className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-600 disabled:opacity-50"
                          title="Enviar a revisión"
                        >
                          <Send className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => remove(t.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-500" title="Eliminar">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                    {t.status === 'PENDING_APPROVAL' && (
                      <button
                        onClick={() => syncStatus(t.id)}
                        disabled={busyId === t.id}
                        className="flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-gray-100 text-gray-500 text-xs disabled:opacity-50"
                        title="Sincronizar estado con Meta"
                      >
                        <RefreshCw className="w-3.5 h-3.5" /> Sincronizar
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {templates.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-400">
                  Sin plantillas todavía.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal open={showModal} onClose={() => setShowModal(false)} title={editingId ? 'Editar plantilla' : 'Nueva plantilla'}>
        <div className="space-y-4">
          {!editingId && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1.5">Nombre (interno de Meta)</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_') })}
                  placeholder="order_confirmed"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono"
                />
                <p className="text-xs text-gray-400 mt-1">Solo minúsculas, números y guiones bajos.</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-1.5">Categoría</label>
                  <select
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value as TemplateCategory })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                  >
                    <option value="MARKETING">Marketing</option>
                    <option value="UTILITY">Utilidad</option>
                    <option value="AUTHENTICATION">Autenticación</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-1.5">Idioma</label>
                  <input
                    value={form.language}
                    onChange={(e) => setForm({ ...form, language: e.target.value })}
                    placeholder="es"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
              </div>
            </>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1.5">Encabezado (opcional)</label>
            <input
              value={form.headerText}
              onChange={(e) => setForm({ ...form, headerText: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1.5">
              Cuerpo — usa <code className="font-mono">{'{{1}}'}</code>, <code className="font-mono">{'{{2}}'}</code>... para variables
            </label>
            <textarea
              value={form.bodyText}
              onChange={(e) => setForm({ ...form, bodyText: e.target.value })}
              rows={4}
              placeholder="Hola {{1}}, tu pedido {{2}} fue confirmado."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
            <p className="text-xs text-gray-400 mt-1">{countPlaceholders(form.bodyText)} variable(s) detectada(s).</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1.5">Pie de página (opcional)</label>
            <input
              value={form.footerText}
              onChange={(e) => setForm({ ...form, footerText: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={() => setShowModal(false)} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-900 hover:bg-gray-50 font-medium text-sm">
            Cancelar
          </button>
          <button onClick={save} className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold text-sm">
            {editingId ? 'Actualizar' : 'Crear'}
          </button>
        </div>
      </Modal>
    </div>
  );
}
