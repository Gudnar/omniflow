'use client';

import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, BookOpen } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/lib/toast-context';
import { apiGet, apiPost, apiPatch, apiDelete } from '@/lib/api-client';
import { Modal } from '@/components/ui/modal';
import type { KnowledgeDocument } from '@/lib/types';

function emptyForm() {
  return { id: null as string | null, title: '', content: '', status: 'ACTIVE' as 'ACTIVE' | 'INACTIVE' };
}

export function KnowledgeTab() {
  const { tokens } = useAuth();
  const toast = useToast();
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm());

  const refetch = () => apiGet<KnowledgeDocument[]>('/knowledge/documents', tokens?.accessToken).then(setDocuments);

  useEffect(() => {
    if (!tokens) return;
    refetch()
      .catch((err) => console.error('Error fetching knowledge documents:', err))
      .finally(() => setLoading(false));
  }, [tokens]);

  const openCreate = () => {
    setForm(emptyForm());
    setShowModal(true);
  };

  const openEdit = (doc: KnowledgeDocument) => {
    setForm({ id: doc.id, title: doc.title, content: doc.content, status: doc.status });
    setShowModal(true);
  };

  const save = async () => {
    if (!form.title.trim() || !form.content.trim()) {
      toast.error('El título y el contenido son obligatorios');
      return;
    }
    setSaving(true);
    try {
      const payload = { title: form.title, content: form.content, status: form.status };
      if (form.id) {
        await apiPatch(`/knowledge/documents/${form.id}`, tokens?.accessToken, payload);
      } else {
        await apiPost('/knowledge/documents', tokens?.accessToken, payload);
      }
      await refetch();
      setShowModal(false);
      toast.success('Documento guardado correctamente');
    } catch (err: any) {
      toast.error(err.message ?? 'No se pudo guardar el documento');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (doc: KnowledgeDocument) => {
    if (!confirm(`¿Eliminar el documento "${doc.title}"?`)) return;
    try {
      await apiDelete(`/knowledge/documents/${doc.id}`, tokens?.accessToken);
      await refetch();
      toast.success('Documento eliminado correctamente');
    } catch (err: any) {
      toast.error(err.message ?? 'No se pudo eliminar el documento');
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
    <div className="space-y-4">
      <div className="flex justify-between items-start gap-3">
        <p className="text-sm text-gray-500 max-w-2xl">
          Pega aquí preguntas frecuentes, políticas o cualquier texto que quieras que un agente pueda usar para
          responder. Cada documento se asigna a los agentes que quieras desde la pestaña "Agentes".
        </p>
        <button
          onClick={openCreate}
          className="shrink-0 flex items-center gap-1.5 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-semibold text-white transition"
        >
          <Plus className="w-4 h-4" />
          Nuevo documento
        </button>
      </div>

      {documents.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 flex flex-col items-center justify-center text-center">
          <BookOpen className="w-8 h-8 text-gray-300 mb-3" />
          <p className="text-sm text-gray-400">Aún no cargaste ningún documento.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {documents.map((doc) => (
            <div key={doc.id} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-bold text-gray-900 truncate">{doc.title}</p>
                <p className="text-xs text-gray-400">
                  {doc._count.chunks} fragmento{doc._count.chunks === 1 ? '' : 's'} indexado
                  {doc._count.chunks === 1 ? '' : 's'} · {doc.status === 'ACTIVE' ? 'Activo' : 'Inactivo'}
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => openEdit(doc)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => remove(doc)} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={showModal} onClose={() => setShowModal(false)} title={form.id ? 'Editar documento' : 'Nuevo documento'} size="lg">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1.5">Título</label>
            <input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Ej: Preguntas frecuentes de envíos"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1.5">Contenido</label>
            <textarea
              value={form.content}
              onChange={(e) => setForm({ ...form, content: e.target.value })}
              rows={10}
              placeholder="Pega aquí el texto: preguntas frecuentes, políticas, horarios, catálogo en texto, etc."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono"
            />
            <p className="text-xs text-gray-400 mt-1">
              Al guardar, el texto se divide en fragmentos y se indexa automáticamente para que los agentes puedan
              encontrarlo.
            </p>
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={form.status === 'ACTIVE'}
              onChange={(e) => setForm({ ...form, status: e.target.checked ? 'ACTIVE' : 'INACTIVE' })}
            />
            Documento activo (disponible para que los agentes lo consulten)
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
            {saving ? 'Guardando e indexando…' : 'Guardar'}
          </button>
        </div>
      </Modal>
    </div>
  );
}
