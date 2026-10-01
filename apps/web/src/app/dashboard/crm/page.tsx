'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Upload, Download } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { apiGet } from '@/lib/api-client';
import type { Contact } from '@/lib/types';
import { ContactProfilePanel } from '@/components/crm/contact-profile-panel';
import { ActivityPanel } from '@/components/crm/activity-panel';

export default function CrmPage() {
  const router = useRouter();
  const { user, tokens, isLoading } = useAuth();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && !user) router.push('/login');
  }, [isLoading, user, router]);

  useEffect(() => {
    if (!user || !tokens) return;
    apiGet<Contact[]>('/contacts', tokens.accessToken)
      .then((data) => {
        setContacts(data);
        setSelectedId((current) => current ?? data[0]?.id ?? null);
      })
      .catch((err) => console.error('Error fetching contacts:', err))
      .finally(() => setDataLoading(false));
  }, [user, tokens]);

  const results = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return [];
    return contacts.filter(
      (c) =>
        c.name.toLowerCase().includes(term) ||
        (c.email ?? '').toLowerCase().includes(term) ||
        (c.phone ?? '').toLowerCase().includes(term) ||
        (c.company?.name ?? '').toLowerCase().includes(term),
    );
  }, [contacts, search]);

  const selected = contacts.find((c) => c.id === selectedId) ?? null;

  if (isLoading || dataLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full" />
      </div>
    );
  }

  return (
    <div className="max-w-[1800px] mx-auto px-4 sm:px-6 py-6 space-y-5">
      {/* Toolbar */}
      <div className="flex flex-col lg:flex-row lg:items-center gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre, email, teléfono o empresa..."
            className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          {results.length > 0 && (
            <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-y-auto">
              {results.map((c) => (
                <button
                  key={c.id}
                  onClick={() => {
                    setSelectedId(c.id);
                    setSearch('');
                  }}
                  className="w-full text-left px-4 py-2.5 hover:bg-gray-50 text-sm"
                >
                  <p className="font-medium text-gray-900">{c.name}</p>
                  <p className="text-xs text-gray-400">{c.email || c.phone || '—'}</p>
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          <button className="flex items-center gap-1.5 px-4 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition">
            <Upload className="w-4 h-4" />
            Importar
          </button>
          <button className="flex items-center gap-1.5 px-4 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition">
            <Download className="w-4 h-4" />
            Exportar
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[320px_1fr] gap-5 items-start">
        <ContactProfilePanel contact={selected} />
        <div className="space-y-5 min-w-0">
          <ActivityPanel contactId={selected?.id ?? null} />
        </div>
      </div>
    </div>
  );
}
