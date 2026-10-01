'use client';

import { MessageCircle, Mail, Phone, MoreHorizontal } from 'lucide-react';
import type { Contact } from '@/lib/types';

const quickActions = [
  { icon: MessageCircle, color: '#22c55e' },
  { icon: Mail, color: '#3b82f6' },
  { icon: Phone, color: '#8b5cf6' },
];

const TYPE_LABELS: Record<Contact['type'], string> = { LEAD: 'Lead', PROSPECT: 'Prospecto', CUSTOMER: 'Cliente' };

function initialsOf(name: string) {
  return name.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('');
}

export function ContactProfilePanel({ contact }: { contact: Contact | null }) {
  if (!contact) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-center justify-center h-40">
        <p className="text-sm text-gray-400">Selecciona un contacto</p>
      </div>
    );
  }

  const infoRows = [
    { label: 'Empresa', value: contact.company?.name ?? '—' },
    { label: 'Fuente', value: contact.source ?? '—' },
    { label: 'Cliente desde', value: new Date(contact.createdAt).toLocaleDateString() },
  ];

  return (
    <div className="space-y-4">
      {/* Profile card */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-start gap-3 mb-4">
          <div className="relative shrink-0">
            <div className="w-14 h-14 rounded-full bg-blue-500 flex items-center justify-center text-white font-semibold text-lg">
              {initialsOf(contact.name)}
            </div>
            <span className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-white" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-base font-bold text-gray-900">{contact.name}</p>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                {TYPE_LABELS[contact.type]}
              </span>
            </div>
            <p className="text-sm text-gray-500 mt-0.5">—</p>
          </div>
        </div>

        <div className="flex items-center gap-2 mb-5">
          {quickActions.map((a, i) => (
            <button
              key={i}
              className="flex-1 h-9 rounded-lg border border-gray-200 flex items-center justify-center hover:bg-gray-50 transition"
            >
              <a.icon className="w-4 h-4" style={{ color: a.color }} />
            </button>
          ))}
          <button className="h-9 w-9 rounded-lg border border-gray-200 flex items-center justify-center hover:bg-gray-50 transition shrink-0">
            <MoreHorizontal className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        <h4 className="text-sm font-bold text-gray-900 mb-3">Información de contacto</h4>
        <div className="space-y-2.5">
          <div className="flex items-center gap-3 text-sm">
            <Phone className="w-4 h-4 text-gray-400 shrink-0" />
            <span className="flex-1 text-gray-700">{contact.phone || '—'}</span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <Mail className="w-4 h-4 text-gray-400 shrink-0" />
            <span className="flex-1 text-gray-700 truncate">{contact.email || '—'}</span>
          </div>
          {infoRows.map((row) => (
            <div key={row.label} className="flex items-center gap-3 text-sm">
              <span className="w-4 shrink-0" />
              <span className="text-gray-500">{row.label}</span>
              <span className="flex-1 text-right font-medium text-gray-900">{row.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Tags */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h4 className="text-sm font-bold text-gray-900 mb-3">Etiquetas</h4>
        <div className="flex flex-wrap gap-2">
          {contact.tags.map(({ tag }) => (
            <span
              key={tag.id}
              className="flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full"
              style={{ backgroundColor: `${tag.color ?? '#e5e7eb'}22`, color: tag.color ?? '#4b5563' }}
            >
              {tag.name}
            </span>
          ))}
          {contact.tags.length === 0 && <span className="text-xs text-gray-400">Sin etiquetas</span>}
        </div>
      </div>

      {/* Owner */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h4 className="text-sm font-bold text-gray-900 mb-4">Propietario</h4>
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">Agente</span>
            <span className="font-medium text-gray-400">—</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">Estado</span>
            <span
              className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                contact.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'
              }`}
            >
              {contact.status === 'ACTIVE' ? 'Activo' : 'Inactivo'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
