'use client';

import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/lib/toast-context';
import { apiGet, apiPost, apiPatch, apiDelete } from '@/lib/api-client';
import type { Category } from '@/lib/types';
import { Modal } from '@/components/ui/modal';

const EMPTY_FORM = { name: '', slug: '', parentId: '' };

export function CategoriesTab() {
  const { tokens } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const toast = useToast();

  const refetch = async () => {
    const data = await apiGet<Category[]>('/categories', tokens?.accessToken);
    setCategories(data);
  };

  useEffect(() => {
    if (!tokens) return;
    refetch()
      .catch((err) => console.error('Error fetching categories:', err))
      .finally(() => setLoading(false));
  }, [tokens]);

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setShowModal(true);
  };

  const openEdit = (category: Category) => {
    setEditingId(category.id);
    setForm({ name: category.name, slug: category.slug, parentId: category.parentId ?? '' });
    setShowModal(true);
  };

  const save = async () => {
    const payload = { name: form.name, slug: form.slug, parentId: form.parentId || undefined };
    try {
      if (editingId) {
        await apiPatch(`/categories/${editingId}`, tokens?.accessToken, payload);
      } else {
        await apiPost('/categories', tokens?.accessToken, payload);
      }
      await refetch();
      setShowModal(false);
      toast.success(editingId ? 'Categoría actualizada correctamente' : 'Categoría creada correctamente');
    } catch (err: any) {
      toast.error(err.message ?? 'No se pudo guardar la categoría');
    }
  };

  const remove = async (id: string) => {
    if (!confirm('¿Eliminar esta categoría?')) return;
    try {
      await apiDelete(`/categories/${id}`, tokens?.accessToken);
      await refetch();
      toast.success('Categoría eliminada correctamente');
    } catch (err: any) {
      toast.error(err.message ?? 'No se pudo eliminar la categoría');
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
        <h3 className="text-base font-bold text-gray-900">Categorías</h3>
        <button
          onClick={openCreate}
          className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-semibold text-white transition"
        >
          <Plus className="w-4 h-4" />
          Nueva categoría
        </button>
      </div>

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100 text-left text-xs font-semibold text-gray-500">
            <th className="px-5 py-3">Nombre</th>
            <th className="px-5 py-3">Slug</th>
            <th className="px-5 py-3">Categoría padre</th>
            <th className="px-5 py-3">Estado</th>
            <th className="px-5 py-3 text-right">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {categories.map((c) => (
            <tr key={c.id} className="border-b border-gray-50 hover:bg-gray-50">
              <td className="px-5 py-3 font-medium text-gray-900">{c.name}</td>
              <td className="px-5 py-3 text-gray-500">{c.slug}</td>
              <td className="px-5 py-3 text-gray-500">
                {categories.find((p) => p.id === c.parentId)?.name ?? '—'}
              </td>
              <td className="px-5 py-3">
                <span
                  className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                    c.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  {c.status === 'ACTIVE' ? 'Activa' : 'Inactiva'}
                </span>
              </td>
              <td className="px-5 py-3 text-right">
                <button onClick={() => openEdit(c)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 mr-1">
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => remove(c.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-500">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </td>
            </tr>
          ))}
          {categories.length === 0 && (
            <tr>
              <td colSpan={5} className="px-5 py-8 text-center text-sm text-gray-400">
                Sin categorías todavía.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <Modal open={showModal} onClose={() => setShowModal(false)} title={editingId ? 'Editar categoría' : 'Nueva categoría'}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1.5">Nombre</label>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1.5">Slug</label>
            <input
              value={form.slug}
              onChange={(e) => setForm({ ...form, slug: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1.5">Categoría padre</label>
            <select
              value={form.parentId}
              onChange={(e) => setForm({ ...form, parentId: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
            >
              <option value="">Ninguna (raíz)</option>
              {categories
                .filter((c) => c.id !== editingId)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </select>
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
            onClick={save}
            className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold text-sm"
          >
            {editingId ? 'Actualizar' : 'Crear'}
          </button>
        </div>
      </Modal>
    </div>
  );
}
