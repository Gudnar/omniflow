'use client';

import { useEffect, useState } from 'react';
import { X, Plus, Trash2, Star, Clock } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/lib/toast-context';
import { apiGet, apiPost, apiPatch, apiDelete } from '@/lib/api-client';
import type { Product, Category, ProductStatus, BranchProduct, InventoryMovement, InventoryMovementType } from '@/lib/types';

const tabs = ['General', 'Variantes', 'Multimedia', 'Sucursales y precios'] as const;
type Tab = (typeof tabs)[number];

const MOVEMENT_TYPE_LABELS: Record<InventoryMovementType, string> = {
  RESTOCK: 'Reabastecimiento',
  SALE: 'Venta',
  RETURN: 'Devolución',
  ADJUSTMENT: 'Ajuste',
  TRANSFER_IN: 'Traspaso entrante',
  TRANSFER_OUT: 'Traspaso saliente',
};

export function ProductDetailPanel({
  productId,
  categories,
  onClose,
  onChanged,
}: {
  productId: string;
  categories: Category[];
  onClose: () => void;
  onChanged: () => void;
}) {
  const { tokens } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('General');
  const [product, setProduct] = useState<Product | null>(null);

  const refetch = async () => {
    const data = await apiGet<Product>(`/products/${productId}`, tokens?.accessToken);
    setProduct(data);
  };

  useEffect(() => {
    setActiveTab('General');
    refetch().catch((err) => console.error('Error fetching product:', err));
  }, [productId, tokens]);

  if (!product) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-8 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full" />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 flex flex-col overflow-hidden max-h-[85vh]">
      <div className="flex items-center justify-between p-5 border-b border-gray-100">
        <div className="min-w-0">
          <p className="text-base font-bold text-gray-900 truncate">{product.name}</p>
          <p className="text-xs text-gray-400">{product.slug}</p>
        </div>
        <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 text-gray-400 transition shrink-0">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex border-b border-gray-100 px-5 overflow-x-auto shrink-0">
        {tabs.map((t) => (
          <button
            key={t}
            onClick={() => setActiveTab(t)}
            className={`px-2.5 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition ${
              activeTab === t ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-5">
        {activeTab === 'General' && (
          <GeneralSection
            product={product}
            categories={categories}
            onSaved={async () => {
              await refetch();
              onChanged();
            }}
            onDeleted={onClose}
          />
        )}
        {activeTab === 'Variantes' && <VariantsSection product={product} onChanged={refetch} />}
        {activeTab === 'Multimedia' && <MediaSection product={product} onChanged={refetch} />}
        {activeTab === 'Sucursales y precios' && <BranchPricingSection product={product} />}
      </div>
    </div>
  );
}

function GeneralSection({
  product,
  categories,
  onSaved,
  onDeleted,
}: {
  product: Product;
  categories: Category[];
  onSaved: () => void;
  onDeleted: () => void;
}) {
  const { tokens } = useAuth();
  const toast = useToast();
  const [name, setName] = useState(product.name);
  const [slug, setSlug] = useState(product.slug);
  const [description, setDescription] = useState(product.description ?? '');
  const [categoryId, setCategoryId] = useState(product.categoryId ?? '');
  const [status, setStatus] = useState<ProductStatus>(product.status);
  const [requiresPreparation, setRequiresPreparation] = useState(product.requiresPreparation);
  const [preparationReason, setPreparationReason] = useState(product.preparationReason ?? '');
  const [preparationMinutes, setPreparationMinutes] = useState(
    product.preparationMinutes != null ? String(product.preparationMinutes) : '',
  );

  const save = async () => {
    try {
      await apiPatch(`/products/${product.id}`, tokens?.accessToken, {
        name,
        slug,
        description: description || undefined,
        categoryId: categoryId || undefined,
        status,
        requiresPreparation,
        preparationReason: requiresPreparation ? preparationReason || undefined : null,
        preparationMinutes: requiresPreparation && preparationMinutes ? Number(preparationMinutes) : null,
      });
      onSaved();
      toast.success('Producto actualizado correctamente');
    } catch (err: any) {
      toast.error(err.message ?? 'No se pudo guardar el producto');
    }
  };

  const remove = async () => {
    if (!confirm('¿Eliminar este producto? Esta acción no se puede deshacer.')) return;
    try {
      await apiDelete(`/products/${product.id}`, tokens?.accessToken);
      onDeleted();
      toast.success('Producto eliminado correctamente');
    } catch (err: any) {
      toast.error(err.message ?? 'No se pudo eliminar el producto');
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-semibold text-gray-600 mb-1.5">Nombre</label>
        <input value={name} onChange={(e) => setName(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>
      <div>
        <label className="block text-xs font-semibold text-gray-600 mb-1.5">Slug</label>
        <input value={slug} onChange={(e) => setSlug(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>
      <div>
        <label className="block text-xs font-semibold text-gray-600 mb-1.5">Descripción</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1.5">Categoría</label>
          <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white">
            <option value="">—</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1.5">Estado</label>
          <select value={status} onChange={(e) => setStatus(e.target.value as ProductStatus)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white">
            <option value="DRAFT">Borrador</option>
            <option value="ACTIVE">Activo</option>
            <option value="ARCHIVED">Archivado</option>
          </select>
        </div>
      </div>

      <div className="border border-gray-200 rounded-lg p-3.5">
        <label className="flex items-center justify-between gap-4 cursor-pointer">
          <span className="flex items-center gap-2 text-sm font-semibold text-gray-900">
            <Clock className="w-4 h-4 text-gray-400" /> Requiere tiempo de preparación
          </span>
          <button
            type="button"
            onClick={() => setRequiresPreparation((v) => !v)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition shrink-0 ${
              requiresPreparation ? 'bg-blue-600' : 'bg-gray-300'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                requiresPreparation ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </label>
        <p className="text-xs text-gray-500 mt-1.5">
          Ej. medicamentos con cadena de frío, comida que se prepara al momento, helados. Se informa al cliente solo
          cuando elige retiro en sucursal, no en entregas a domicilio ni envíos.
        </p>

        {requiresPreparation && (
          <div className="grid grid-cols-2 gap-3 mt-3">
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Motivo</label>
              <input
                value={preparationReason}
                onChange={(e) => setPreparationReason(e.target.value)}
                placeholder="Ej. Requiere cadena de frío"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Minutos estimados</label>
              <input
                type="number"
                min={1}
                value={preparationMinutes}
                onChange={(e) => setPreparationMinutes(e.target.value)}
                placeholder="30"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        )}
      </div>

      <div className="flex justify-between pt-2">
        <button onClick={remove} className="px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg">
          Eliminar producto
        </button>
        <button onClick={save} className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-semibold text-white transition">
          Guardar cambios
        </button>
      </div>
    </div>
  );
}

function VariantsSection({ product, onChanged }: { product: Product; onChanged: () => void }) {
  const { tokens } = useAuth();
  const toast = useToast();
  const [form, setForm] = useState({ name: '', sku: '' });

  const add = async () => {
    if (!form.sku.trim()) return;
    try {
      await apiPost(`/products/${product.id}/variants`, tokens?.accessToken, { name: form.name || undefined, sku: form.sku });
      setForm({ name: '', sku: '' });
      onChanged();
      toast.success('Variante agregada correctamente');
    } catch (err: any) {
      toast.error(err.message ?? 'No se pudo agregar la variante');
    }
  };

  const remove = async (variantId: string) => {
    try {
      await apiDelete(`/products/${product.id}/variants/${variantId}`, tokens?.accessToken);
      onChanged();
      toast.success('Variante eliminada correctamente');
    } catch (err: any) {
      toast.error(err.message ?? 'No se pudo eliminar la variante');
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {product.variants.map((v) => (
          <div key={v.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
            <div>
              <p className="text-sm font-medium text-gray-900">{v.name || 'Variante única'}</p>
              <p className="text-xs text-gray-400">SKU: {v.sku}</p>
            </div>
            <button
              onClick={() => remove(v.id)}
              disabled={product.variants.length <= 1}
              className="p-1.5 rounded-lg hover:bg-red-50 text-red-500 disabled:opacity-30 disabled:hover:bg-transparent"
              title={product.variants.length <= 1 ? 'Un producto debe tener al menos una variante' : 'Eliminar'}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
        <input
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder="Nombre (ej. Talla M)"
          className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <input
          value={form.sku}
          onChange={(e) => setForm({ ...form, sku: e.target.value })}
          placeholder="SKU"
          className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button onClick={add} className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold shrink-0">
          Agregar
        </button>
      </div>
    </div>
  );
}

function MediaSection({ product, onChanged }: { product: Product; onChanged: () => void }) {
  const { tokens } = useAuth();
  const toast = useToast();
  const [url, setUrl] = useState('');

  const add = async () => {
    if (!url.trim()) return;
    try {
      await apiPost(`/products/${product.id}/media`, tokens?.accessToken, { url, isPrimary: product.media.length === 0 });
      setUrl('');
      onChanged();
      toast.success('Imagen agregada correctamente');
    } catch (err: any) {
      toast.error(err.message ?? 'No se pudo agregar la imagen');
    }
  };

  const setPrimary = async (mediaId: string) => {
    try {
      await apiPatch(`/products/${product.id}/media/${mediaId}`, tokens?.accessToken, { isPrimary: true });
      onChanged();
      toast.success('Imagen principal actualizada');
    } catch (err: any) {
      toast.error(err.message ?? 'No se pudo actualizar la imagen principal');
    }
  };

  const remove = async (mediaId: string) => {
    try {
      await apiDelete(`/products/${product.id}/media/${mediaId}`, tokens?.accessToken);
      onChanged();
      toast.success('Imagen eliminada correctamente');
    } catch (err: any) {
      toast.error(err.message ?? 'No se pudo eliminar la imagen');
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        {product.media.map((m) => (
          <div key={m.id} className="relative group border border-gray-200 rounded-lg overflow-hidden aspect-square">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={m.url} alt={m.altText ?? ''} className="w-full h-full object-cover" />
            {m.isPrimary && (
              <span className="absolute top-1 left-1 bg-blue-600 text-white text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex items-center gap-1">
                <Star className="w-2.5 h-2.5" /> Principal
              </span>
            )}
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-2">
              {!m.isPrimary && (
                <button onClick={() => setPrimary(m.id)} className="p-1.5 bg-white rounded-full text-gray-700" title="Marcar como principal">
                  <Star className="w-3.5 h-3.5" />
                </button>
              )}
              <button onClick={() => remove(m.id)} className="p-1.5 bg-white rounded-full text-red-500" title="Eliminar">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
        {product.media.length === 0 && <p className="col-span-3 text-sm text-gray-400 text-center py-8">Sin imágenes todavía.</p>}
      </div>

      <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://..."
          className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button onClick={add} className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold shrink-0 flex items-center gap-1">
          <Plus className="w-4 h-4" /> Agregar
        </button>
      </div>
    </div>
  );
}

function BranchPricingSection({ product }: { product: Product }) {
  const { tokens } = useAuth();
  const toast = useToast();
  const [rows, setRows] = useState<BranchProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [adjustForm, setAdjustForm] = useState({ type: 'RESTOCK' as InventoryMovementType, quantityChange: 0, note: '' });

  const refetch = () =>
    apiGet<BranchProduct[]>(`/products/${product.id}/branch-products`, tokens?.accessToken).then(setRows);

  useEffect(() => {
    if (!tokens) return;
    refetch()
      .catch((err) => console.error('Error fetching branch products:', err))
      .finally(() => setLoading(false));
  }, [product.id, tokens]);

  const updateField = async (id: string, field: string, value: unknown) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
    try {
      await apiPatch(`/branch-products/${id}`, tokens?.accessToken, { [field]: value });
      toast.success('Cambios guardados correctamente');
    } catch (err: any) {
      toast.error(err.message ?? 'No se pudo guardar el cambio');
      refetch();
    }
  };

  const toggleExpand = async (id: string) => {
    if (expandedId === id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(id);
    setAdjustForm({ type: 'RESTOCK', quantityChange: 0, note: '' });
    try {
      const data = await apiGet<InventoryMovement[]>(`/branch-products/${id}/movements`, tokens?.accessToken);
      setMovements(data);
    } catch (err) {
      console.error('Error fetching movements:', err);
    }
  };

  const adjustStock = async (id: string) => {
    if (!adjustForm.quantityChange) return;
    try {
      await apiPost(`/branch-products/${id}/adjust-stock`, tokens?.accessToken, adjustForm);
      await refetch();
      const data = await apiGet<InventoryMovement[]>(`/branch-products/${id}/movements`, tokens?.accessToken);
      setMovements(data);
      setAdjustForm({ type: 'RESTOCK', quantityChange: 0, note: '' });
      toast.success('Stock ajustado correctamente');
    } catch (err: any) {
      toast.error(err.message ?? 'Error ajustando stock');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin w-6 h-6 border-4 border-blue-200 border-t-blue-600 rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {rows.map((row) => (
        <div key={row.id} className="border border-gray-200 rounded-lg overflow-hidden">
          <div className="p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-gray-900">{row.branch.name}</p>
                <p className="text-xs text-gray-400">{row.variant.name || 'Variante única'} · {row.variant.sku}</p>
              </div>
              <select
                value={row.status}
                onChange={(e) => updateField(row.id, 'status', e.target.value)}
                className={`text-xs font-semibold px-2 py-1 rounded-full border-0 ${
                  row.status === 'AVAILABLE' ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'
                }`}
              >
                <option value="AVAILABLE">Disponible</option>
                <option value="UNAVAILABLE">No disponible</option>
              </select>
            </div>

            <div className="grid grid-cols-4 gap-2">
              <div>
                <label className="block text-[10px] text-gray-400 mb-0.5">Precio</label>
                <input
                  type="number"
                  step="0.01"
                  defaultValue={row.price}
                  onBlur={(e) => updateField(row.id, 'price', Number(e.target.value))}
                  className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm"
                />
              </div>
              <div>
                <label className="block text-[10px] text-gray-400 mb-0.5">Precio anterior</label>
                <input
                  type="number"
                  step="0.01"
                  defaultValue={row.compareAtPrice ?? ''}
                  onBlur={(e) => updateField(row.id, 'compareAtPrice', e.target.value ? Number(e.target.value) : null)}
                  className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm"
                />
              </div>
              <div>
                <label className="block text-[10px] text-gray-400 mb-0.5">Stock mínimo</label>
                <input
                  type="number"
                  defaultValue={row.minStock ?? ''}
                  onBlur={(e) => updateField(row.id, 'minStock', e.target.value ? Number(e.target.value) : null)}
                  className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm"
                />
              </div>
              <div>
                <label className="block text-[10px] text-gray-400 mb-0.5">Stock actual</label>
                <button
                  onClick={() => toggleExpand(row.id)}
                  className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm font-semibold text-gray-900 hover:bg-gray-50 text-left"
                >
                  {row.stock}
                </button>
              </div>
            </div>
          </div>

          {expandedId === row.id && (
            <div className="bg-gray-50 border-t border-gray-200 p-3 space-y-3">
              <div className="flex items-center gap-2">
                <select
                  value={adjustForm.type}
                  onChange={(e) => setAdjustForm({ ...adjustForm, type: e.target.value as InventoryMovementType })}
                  className="px-2 py-1.5 border border-gray-200 rounded text-xs bg-white"
                >
                  {Object.entries(MOVEMENT_TYPE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  value={adjustForm.quantityChange || ''}
                  onChange={(e) => setAdjustForm({ ...adjustForm, quantityChange: Number(e.target.value) })}
                  placeholder="+/- cantidad"
                  className="w-28 px-2 py-1.5 border border-gray-200 rounded text-xs"
                />
                <input
                  value={adjustForm.note}
                  onChange={(e) => setAdjustForm({ ...adjustForm, note: e.target.value })}
                  placeholder="Motivo (opcional)"
                  className="flex-1 px-2 py-1.5 border border-gray-200 rounded text-xs"
                />
                <button
                  onClick={() => adjustStock(row.id)}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-semibold shrink-0"
                >
                  Ajustar
                </button>
              </div>

              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                {movements.map((m) => (
                  <div key={m.id} className="flex items-center justify-between text-xs">
                    <span className="text-gray-600">{MOVEMENT_TYPE_LABELS[m.type]}{m.note ? ` · ${m.note}` : ''}</span>
                    <span className={`font-semibold ${m.quantityChange >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                      {m.quantityChange >= 0 ? '+' : ''}
                      {m.quantityChange}
                    </span>
                  </div>
                ))}
                {movements.length === 0 && <p className="text-xs text-gray-400">Sin movimientos todavía.</p>}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
