'use client';

import { useMemo, useState } from 'react';
import { Search, ChevronDown, SlidersHorizontal, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import type { Contact } from '@/lib/types';
import { ChannelIcon } from '@/components/conversations/channel-icon';
import type { Channel } from '@/components/conversations/mock-data';

const filters = ['Todos los canales', 'Etiquetas', 'Estado', 'Más filtros'];

const TYPE_LABELS: Record<Contact['type'], string> = {
  LEAD: 'Lead',
  PROSPECT: 'Prospecto',
  CUSTOMER: 'Cliente',
};

const CHANNEL_SOURCES = new Set(['WHATSAPP', 'INSTAGRAM', 'FACEBOOK', 'TIKTOK', 'MESSENGER']);

function initialsOf(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

function colorFor(id: string) {
  const palette = ['#ec4899', '#3b82f6', '#a855f7', '#f59e0b', '#22c55e', '#6366f1', '#14b8a6', '#f43f5e', '#0ea5e9', '#84cc16'];
  let hash = 0;
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) % palette.length;
  return palette[hash];
}

export function ContactsTable({
  contacts,
  selectedId,
  onSelect,
  onEdit,
  onDelete,
}: {
  contacts: Contact[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onEdit: (contact: Contact) => void;
  onDelete: (id: string) => void;
}) {
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [search, setSearch] = useState('');
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return contacts;
    return contacts.filter(
      (c) =>
        c.name.toLowerCase().includes(term) ||
        (c.email ?? '').toLowerCase().includes(term) ||
        (c.phone ?? '').toLowerCase().includes(term),
    );
  }, [contacts, search]);

  const toggleAll = (value: boolean) => {
    const next: Record<string, boolean> = {};
    if (value) filtered.forEach((c) => (next[c.id] = true));
    setChecked(next);
  };

  const allChecked = filtered.length > 0 && filtered.every((c) => checked[c.id]);

  return (
    <div className="bg-white rounded-xl border border-gray-200 flex flex-col">
      {/* Toolbar */}
      <div className="p-4 border-b border-gray-100 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar contacto por nombre, email o teléfono..."
            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        {filters.map((f) => (
          <button
            key={f}
            className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 transition"
          >
            {f}
            <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
          </button>
        ))}
        <button className="p-2 border border-gray-200 rounded-lg text-gray-500 hover:bg-gray-50 transition">
          <SlidersHorizontal className="w-4 h-4" />
        </button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-left text-xs font-semibold text-gray-500">
              <th className="w-10 px-4 py-3">
                <input
                  type="checkbox"
                  checked={allChecked}
                  onChange={(e) => toggleAll((e.target as HTMLInputElement).checked)}
                  className="w-4 h-4 rounded border-gray-300 accent-blue-600 cursor-pointer"
                />
              </th>
              <th className="px-3 py-3">Contacto</th>
              <th className="px-3 py-3">Canal</th>
              <th className="px-3 py-3">Teléfono</th>
              <th className="px-3 py-3">Email</th>
              <th className="px-3 py-3">Etiquetas</th>
              <th className="px-3 py-3">Estado</th>
              <th className="px-3 py-3">Última actividad</th>
              <th className="px-3 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => (
              <tr
                key={c.id}
                onClick={() => onSelect(c.id)}
                className={`border-b border-gray-50 cursor-pointer transition ${
                  selectedId === c.id ? 'bg-blue-50' : 'hover:bg-gray-50'
                }`}
              >
                <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={!!checked[c.id]}
                    onChange={(e) =>
                      setChecked((prev) => ({ ...prev, [c.id]: (e.target as HTMLInputElement).checked }))
                    }
                    className="w-4 h-4 rounded border-gray-300 accent-blue-600 cursor-pointer"
                  />
                </td>
                <td className="px-3 py-3">
                  <div className="flex items-center gap-2.5">
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-semibold shrink-0"
                      style={{ backgroundColor: colorFor(c.id) }}
                    >
                      {initialsOf(c.name)}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900 truncate">{c.name}</p>
                      <p className="text-xs text-gray-400">{TYPE_LABELS[c.type]}</p>
                    </div>
                  </div>
                </td>
                <td className="px-3 py-3">
                  {c.source && CHANNEL_SOURCES.has(c.source) ? (
                    <ChannelIcon channel={c.source.toLowerCase() as Channel} className="w-4 h-4" />
                  ) : (
                    <span className="text-xs text-gray-400">—</span>
                  )}
                </td>
                <td className="px-3 py-3 text-gray-600 whitespace-nowrap">{c.phone || '—'}</td>
                <td className="px-3 py-3 text-gray-600">{c.email || '—'}</td>
                <td className="px-3 py-3">
                  <div className="flex flex-wrap gap-1">
                    {c.tags.map(({ tag }) => (
                      <span
                        key={tag.id}
                        className="text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap"
                        style={{ backgroundColor: `${tag.color ?? '#e5e7eb'}22`, color: tag.color ?? '#4b5563' }}
                      >
                        {tag.name}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-3 py-3">
                  <span
                    className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                      c.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {c.status === 'ACTIVE' ? 'Activo' : 'Inactivo'}
                  </span>
                </td>
                <td className="px-3 py-3 text-gray-500 whitespace-nowrap">
                  {new Date(c.updatedAt).toLocaleDateString()}
                </td>
                <td className="px-3 py-3 text-right relative" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => setOpenMenuId(openMenuId === c.id ? null : c.id)}
                    className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition"
                  >
                    <MoreHorizontal className="w-4 h-4" />
                  </button>
                  {openMenuId === c.id && (
                    <div className="absolute right-3 top-9 z-10 bg-white border border-gray-200 rounded-lg shadow-lg py-1 w-36">
                      <button
                        onClick={() => {
                          onEdit(c);
                          setOpenMenuId(null);
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                      >
                        <Pencil className="w-3.5 h-3.5" /> Editar
                      </button>
                      <button
                        onClick={() => {
                          onDelete(c.id);
                          setOpenMenuId(null);
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Eliminar
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="p-4 flex items-center justify-between">
        <p className="text-sm text-gray-500">Mostrando {filtered.length} contactos</p>
      </div>
    </div>
  );
}
