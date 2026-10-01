'use client';

import { useMemo, useState } from 'react';
import { Search, Package } from 'lucide-react';
import type { Product } from '@/lib/types';

const STATUS_LABELS: Record<string, string> = { DRAFT: 'Borrador', ACTIVE: 'Activo', ARCHIVED: 'Archivado' };
const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-500',
  ACTIVE: 'bg-emerald-50 text-emerald-700',
  ARCHIVED: 'bg-amber-50 text-amber-700',
};

export function ProductsTable({
  products,
  selectedId,
  onSelect,
}: {
  products: Product[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return products;
    return products.filter((p) => p.name.toLowerCase().includes(term) || p.slug.toLowerCase().includes(term));
  }, [products, search]);

  return (
    <div className="bg-white rounded-xl border border-gray-200 flex flex-col">
      <div className="p-4 border-b border-gray-100">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar producto por nombre o slug..."
            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-left text-xs font-semibold text-gray-500">
              <th className="px-4 py-3">Producto</th>
              <th className="px-3 py-3">Categoría</th>
              <th className="px-3 py-3">Variantes</th>
              <th className="px-3 py-3">Estado</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => {
              const primaryMedia = p.media[0];
              return (
                <tr
                  key={p.id}
                  onClick={() => onSelect(p.id)}
                  className={`border-b border-gray-50 cursor-pointer transition ${
                    selectedId === p.id ? 'bg-blue-50' : 'hover:bg-gray-50'
                  }`}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center shrink-0 overflow-hidden">
                        {primaryMedia ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={primaryMedia.url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <Package className="w-4 h-4 text-gray-300" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-900 truncate">{p.name}</p>
                        <p className="text-xs text-gray-400">{p.slug}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-gray-600">{p.category?.name ?? '—'}</td>
                  <td className="px-3 py-3 text-gray-600">{p.variants.length}</td>
                  <td className="px-3 py-3">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_COLORS[p.status]}`}>
                      {STATUS_LABELS[p.status]}
                    </span>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-sm text-gray-400">
                  Sin productos todavía.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="p-4">
        <p className="text-sm text-gray-500">Mostrando {filtered.length} productos</p>
      </div>
    </div>
  );
}
