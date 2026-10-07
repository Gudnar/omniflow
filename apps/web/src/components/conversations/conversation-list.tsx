'use client';

import { useMemo, useState } from 'react';
import { Search, ChevronDown, Download, Megaphone } from 'lucide-react';
import type { Conversation, ConversationStatus } from '@/lib/types';
import { ChannelBadge } from './channel-icon';
import type { Channel } from './mock-data';

const STATUS_TABS: { key: 'all' | ConversationStatus; label: string }[] = [
  { key: 'all', label: 'Todas' },
  { key: 'OPEN', label: 'Abiertas' },
  { key: 'PENDING', label: 'Pendientes' },
  { key: 'CLOSED', label: 'Cerradas' },
];

const STATUS_LABELS: Record<ConversationStatus, string> = {
  OPEN: 'Abierta',
  PENDING: 'Pendiente',
  CLOSED: 'Cerrada',
};

const filters = ['Todos los canales', 'Todos los agentes', 'Asignación'];

function initialsOf(name: string) {
  return name.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('');
}

function colorFor(id: string) {
  const palette = ['#ec4899', '#3b82f6', '#a855f7', '#f59e0b', '#22c55e', '#6366f1', '#14b8a6', '#f43f5e'];
  let hash = 0;
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) % palette.length;
  return palette[hash];
}

export function ConversationList({
  conversations,
  selectedId,
  onSelect,
}: {
  conversations: Conversation[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const [activeTab, setActiveTab] = useState<'all' | ConversationStatus>('all');
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    let list = activeTab === 'all' ? conversations : conversations.filter((c) => c.status === activeTab);
    const term = search.trim().toLowerCase();
    if (term) list = list.filter((c) => c.contact.name.toLowerCase().includes(term));
    return list;
  }, [conversations, activeTab, search]);

  const counts = {
    all: conversations.length,
    OPEN: conversations.filter((c) => c.status === 'OPEN').length,
    PENDING: conversations.filter((c) => c.status === 'PENDING').length,
    CLOSED: conversations.filter((c) => c.status === 'CLOSED').length,
  };

  return (
    <div className="w-full h-full flex flex-col bg-white border-r border-gray-200">
      {/* Filters row */}
      <div className="p-4 border-b border-gray-100 space-y-3 shrink-0">
        <div className="flex flex-wrap items-center gap-2">
          {filters.map((f) => (
            <button
              key={f}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-50 transition"
            >
              {f}
              <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
            </button>
          ))}
          <div className="relative flex-1 min-w-[160px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar conversación o contacto..."
              className="w-full pl-8 pr-3 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <button className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-50 transition">
            <Download className="w-3.5 h-3.5" />
            Exportar
          </button>
        </div>
      </div>

      {/* Tabs + list */}
      <div className="flex border-b border-gray-100 px-2 shrink-0">
        {STATUS_TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`flex items-center gap-1.5 px-3 py-3 text-sm font-medium border-b-2 transition ${
              activeTab === t.key
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
            <span
              className={`text-xs font-semibold rounded-full px-1.5 py-0.5 min-w-[20px] text-center ${
                activeTab === t.key ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
              }`}
            >
              {counts[t.key]}
            </span>
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        {filtered.map((c) => (
          <button
            key={c.id}
            onClick={() => onSelect(c.id)}
            className={`w-full flex items-start gap-3 px-4 py-3.5 border-b border-gray-50 text-left transition relative ${
              selectedId === c.id ? 'bg-blue-50' : 'hover:bg-gray-50'
            }`}
          >
            {selectedId === c.id && <span className="absolute left-0 top-0 bottom-0 w-0.5 bg-blue-600" />}
            <div className="relative shrink-0">
              <div
                className="w-11 h-11 rounded-full flex items-center justify-center text-white text-sm font-semibold"
                style={{ backgroundColor: colorFor(c.contact.id) }}
              >
                {initialsOf(c.contact.name)}
              </div>
              <span className="absolute -bottom-0.5 -right-0.5">
                <ChannelBadge channel={c.channel.toLowerCase() as Channel} />
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-gray-900 truncate flex items-center gap-1.5">
                  <span className="truncate">{c.contact.name}</span>
                  {c.isNewContact && (
                    <span className="shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-green-100 text-green-700">
                      Nuevo
                    </span>
                  )}
                  {c.adReferral && (
                    <span className="shrink-0" title={c.adReferral.headline ?? 'Llegó desde un anuncio'}>
                      <Megaphone className="w-3 h-3 text-amber-500" />
                    </span>
                  )}
                </p>
                <span className="text-xs text-gray-400 shrink-0">
                  {new Date(c.lastMessageAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2 mt-0.5">
                <p className="text-xs text-gray-500 truncate">{STATUS_LABELS[c.status]}</p>
              </div>
            </div>
          </button>
        ))}

        {filtered.length === 0 && (
          <div className="p-4 text-center">
            <p className="text-xs text-gray-400">No hay conversaciones</p>
          </div>
        )}
      </div>
    </div>
  );
}
