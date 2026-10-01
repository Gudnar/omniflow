'use client';

import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/lib/toast-context';
import { apiGet, apiPost, apiPatch, apiDelete } from '@/lib/api-client';
import type { Segment, ContactStatus, ContactType, Tag } from '@/lib/types';
import { Modal } from '@/components/ui/modal';

const EMPTY_FORM = { name: '', description: '', status: '' as ContactStatus | '', type: '' as ContactType | '', tagIds: [] as string[] };

export function SegmentsTab() {
  const { tokens } = useAuth();
  const toast = useToast();
  const [segments, setSegments] = useState<Segment[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const refetch = () => apiGet<Segment[]>('/segments', tokens?.accessToken).then(setSegments);

  useEffect(() => {
    if (!tokens) return;
    Promise.all([refetch(), apiGet<Tag[]>('/tags', tokens.accessToken).then(setTags)])
      .catch((err) => console.error('Error fetching segments:', err))
      .finally(() => setLoading(false));
  }, [tokens]);

  useEffect(() => {
    if (!tokens || segments.length === 0) return;
    Promise.all(
      segments.map((s) =>
        apiGet<{ count: number }>(`/segments/${s.id}/preview-count`, tokens.accessToken).then((r) => [s.id, r.count] as const),
      ),
    ).then((entries) => setCounts(Object.fromEntries(entries)));
  }, [segments, tokens]);

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setShowModal(true);
  };

  const openEdit = (s: Segment) => {
    setEditingId(s.id);
    setForm({
      name: s.name,
      description: s.description ?? '',
      status: s.filterQuery.status ?? '',
      type: s.filterQuery.type ?? '',
      tagIds: s.filterQuery.tagIds ?? [],
    });
    setShowModal(true);
  };

  const toggleTag = (tagId: string) => {
    setForm((f) => ({
      ...f,
      tagIds: f.tagIds.includes(tagId) ? f.tagIds.filter((t) => t !== tagId) : [...f.tagIds, tagId],
    }));
  };

  const buildPayload = () => ({
    name: form.name,
    description: form.description || undefined,
    filterQuery: {
      ...(form.status && { status: form.status }),
      ...(form.type && { type: form.type }),
      ...(form.tagIds.length && { tagIds: form.tagIds }),
    },
  });

  const save = async () => {
    if (!form.name.trim()) return;
    try {
      if (editingId) {
        await apiPatch(`/segments/${editingId}`, tokens?.accessToken, buildPayload());
      } else {
        await apiPost('/segments', tokens?.accessToken, buildPayload());
      }
      await refetch();
      setShowModal(false);
      toast.success(editingId ? 'Segmento actualizado correctamente' : 'Segmento creado correctamente');
    } catch (err: any) {
      toast.error(err.message ?? 'Error al guardar el segmento');
    }
  };

  const remove = async (id: string) => {
    if (!confirm('¿Eliminar este segmento?')) return;
    try {
      await apiDelete(`/segments/${id}`, tokens?.accessToken);
      await refetch();
      toast.success('Segmento eliminado correctamente');
    } catch (err: any) {
      toast.error(err.message ?? 'Error al eliminar el segmento');
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
      <div className="flex justify-end">
        <button
          onClick={openCreate}
          className="flex items-center gap-1.5 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-semibold text-white transition"
        >
          <Plus className="w-4 h-4" />
          Nuevo segmento
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-left text-xs font-semibold text-gray-500">
              <th className="px-4 py-3">Nombre</th>
              <th className="px-3 py-3">Filtros</th>
              <th className="px-3 py-3">Contactos</th>
              <th className="px-3 py-3">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {segments.map((s) => (
              <tr key={s.id} className="border-b border-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900">{s.name}</td>
                <td className="px-3 py-3 text-gray-500 text-xs">
                  {[
                    s.filterQuery.status && `Estado: ${s.filterQuery.status}`,
                    s.filterQuery.type && `Tipo: ${s.filterQuery.type}`,
                    s.filterQuery.tagIds?.length && `${s.filterQuery.tagIds.length} etiqueta(s)`,
                  ]
                    .filter(Boolean)
                    .join(' · ') || 'Todos los contactos'}
                </td>
                <td className="px-3 py-3 font-medium text-gray-900">{counts[s.id] ?? '—'}</td>
                <td className="px-3 py-3">
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => openEdit(s)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => remove(s.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-500">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {segments.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-sm text-gray-400">
                  Sin segmentos todavía.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal open={showModal} onClose={() => setShowModal(false)} title={editingId ? 'Editar segmento' : 'Nuevo segmento'}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1.5">Nombre</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1.5">Descripción</label>
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-1.5">Estado</label>
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as any })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white">
                <option value="">Cualquiera</option>
                <option value="ACTIVE">Activo</option>
                <option value="INACTIVE">Inactivo</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-1.5">Tipo</label>
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as any })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white">
                <option value="">Cualquiera</option>
                <option value="LEAD">Lead</option>
                <option value="PROSPECT">Prospecto</option>
                <option value="CUSTOMER">Cliente</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1.5">Etiquetas</label>
            <div className="flex flex-wrap gap-1.5">
              {tags.map((tag) => (
                <button
                  key={tag.id}
                  onClick={() => toggleTag(tag.id)}
                  className={`text-xs font-medium px-2.5 py-1 rounded-full border transition ${
                    form.tagIds.includes(tag.id) ? 'bg-blue-600 border-blue-600 text-white' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {tag.name}
                </button>
              ))}
              {tags.length === 0 && <p className="text-xs text-gray-400">Sin etiquetas creadas.</p>}
            </div>
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
