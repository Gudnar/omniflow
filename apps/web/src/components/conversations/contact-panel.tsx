'use client';

import { useEffect, useState } from 'react';
import { Pencil, Mail, Calendar, Tag as TagIcon, Phone, Building2 } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { apiGet } from '@/lib/api-client';
import type { Conversation, Contact } from '@/lib/types';

const TYPE_LABELS: Record<Contact['type'], string> = { LEAD: 'Lead', PROSPECT: 'Prospecto', CUSTOMER: 'Cliente' };

function initialsOf(name: string) {
  return name.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('');
}

export function ContactPanel({ conversation }: { conversation: Conversation | null }) {
  const { tokens } = useAuth();
  const [contact, setContact] = useState<Contact | null>(null);

  useEffect(() => {
    if (!conversation) {
      setContact(null);
      return;
    }
    apiGet<Contact>(`/contacts/${conversation.contactId}`, tokens?.accessToken)
      .then(setContact)
      .catch((err) => console.error('Error fetching contact:', err));
  }, [conversation, tokens]);

  if (!conversation || !contact) {
    return <div className="w-full h-full bg-white border-l border-gray-200" />;
  }

  return (
    <div className="w-full h-full flex flex-col bg-white border-l border-gray-200 overflow-y-auto">
      <div className="p-5 border-b border-gray-100">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-full bg-pink-500 flex items-center justify-center text-white font-semibold shrink-0">
            {initialsOf(contact.name)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <p className="text-sm font-bold text-gray-900 truncate">{contact.name}</p>
              <Pencil className="w-3 h-3 text-gray-400 shrink-0" />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <span className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-50 text-amber-700">
            <TagIcon className="w-3 h-3" /> {TYPE_LABELS[contact.type]}
          </span>
        </div>
      </div>

      <div className="p-5 space-y-6">
        {/* Info section */}
        <div className="space-y-3">
          <div className="flex items-center gap-3 text-sm">
            <Phone className="w-4 h-4 text-gray-400 shrink-0" />
            <span className="flex-1 text-gray-700">{contact.phone || '—'}</span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <Mail className="w-4 h-4 text-gray-400 shrink-0" />
            <span className="flex-1 text-gray-700 truncate">{contact.email || '—'}</span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <Building2 className="w-4 h-4 text-gray-400 shrink-0" />
            <span className="flex-1 text-gray-700">{contact.company?.name ?? '—'}</span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <Calendar className="w-4 h-4 text-gray-400 shrink-0" />
            <span className="flex-1 text-gray-700">Cliente desde: {new Date(contact.createdAt).toLocaleDateString()}</span>
          </div>
          <div className="flex items-start gap-3 text-sm">
            <TagIcon className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-gray-500 mb-1.5">Etiquetas:</p>
              <div className="flex flex-wrap gap-1.5">
                {contact.tags.map(({ tag }) => (
                  <span
                    key={tag.id}
                    className="text-xs font-medium px-2 py-1 rounded-md"
                    style={{ backgroundColor: `${tag.color ?? '#e5e7eb'}22`, color: tag.color ?? '#4b5563' }}
                  >
                    {tag.name}
                  </span>
                ))}
                {contact.tags.length === 0 && <span className="text-xs text-gray-400">Sin etiquetas</span>}
              </div>
            </div>
          </div>
        </div>

        {/* Summary */}
        <div>
          <h4 className="text-sm font-bold text-gray-900 mb-3">Resumen</h4>
          <div className="space-y-2.5 text-sm">
            {['Total conversaciones', 'Pedidos', 'Total comprado', 'Último pedido'].map((label) => (
              <div key={label} className="flex justify-between">
                <span className="text-gray-500">{label}</span>
                <span className="font-semibold text-gray-400">—</span>
              </div>
            ))}
          </div>
        </div>

        {/* Assignment */}
        <div>
          <h4 className="text-sm font-bold text-gray-900 mb-3">Asignación</h4>
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-gray-500">Agente</span>
              <span className="font-medium text-gray-400">—</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-500">Estado</span>
              <span
                className={`flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full ${
                  contact.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'
                }`}
              >
                {contact.status === 'ACTIVE' ? 'Activo' : 'Inactivo'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
