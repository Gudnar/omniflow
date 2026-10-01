'use client';

import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/lib/toast-context';
import { apiGet, apiPost } from '@/lib/api-client';
import type { Product, Category, ProductStatus } from '@/lib/types';
import { Modal } from '@/components/ui/modal';
import { ProductsTable } from './products-table';
import { ProductDetailPanel } from './product-detail-panel';

const EMPTY_FORM = { name: '', slug: '', categoryId: '', status: 'DRAFT' as ProductStatus };

export function CatalogTab() {
  const { tokens } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const toast = useToast();

  const refetch = () => apiGet<Product[]>('/products', tokens?.accessToken).then(setProducts);

  useEffect(() => {
    if (!tokens) return;
    Promise.all([refetch(), apiGet<Category[]>('/categories', tokens.accessToken).then(setCategories)])
      .catch((err) => console.error('Error fetching products:', err))
      .finally(() => setLoading(false));
  }, [tokens]);

  const create = async () => {
    try {
      const created = await apiPost<Product>('/products', tokens?.accessToken, {
        name: form.name,
        slug: form.slug,
        categoryId: form.categoryId || undefined,
        status: form.status,
      });
      await refetch();
      setShowModal(false);
      setForm(EMPTY_FORM);
      setSelectedId(created.id);
      toast.success('Producto creado correctamente');
    } catch (err: any) {
      toast.error(err.message ?? 'No se pudo crear el producto');
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
          onClick={() => setShowModal(true)}
          className="flex items-center gap-1.5 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-semibold text-white transition"
        >
          <Plus className="w-4 h-4" />
          Nuevo producto
        </button>
      </div>

      <ProductsTable products={products} selectedId={selectedId} onSelect={setSelectedId} />

      <Modal open={!!selectedId} onClose={() => setSelectedId(null)} size="xl">
        {selectedId && (
          <ProductDetailPanel
            productId={selectedId}
            categories={categories}
            onClose={() => setSelectedId(null)}
            onChanged={refetch}
          />
        )}
      </Modal>

      <Modal open={showModal} onClose={() => setShowModal(false)} title="Nuevo producto">
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
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-1.5">Categoría</label>
              <select
                value={form.categoryId}
                onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
              >
                <option value="">—</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-1.5">Estado</label>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value as ProductStatus })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
              >
                <option value="DRAFT">Borrador</option>
                <option value="ACTIVE">Activo</option>
                <option value="ARCHIVED">Archivado</option>
              </select>
            </div>
          </div>
          <p className="text-xs text-gray-400">
            Se creará una variante por defecto. Podrás agregar más variantes, multimedia y precios por sucursal después de crear el producto.
          </p>
        </div>
        <div className="flex gap-3 mt-6">
          <button
            onClick={() => setShowModal(false)}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-900 hover:bg-gray-50 font-medium text-sm"
          >
            Cancelar
          </button>
          <button onClick={create} className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold text-sm">
            Crear
          </button>
        </div>
      </Modal>
    </div>
  );
}
