'use client';

import { useState } from 'react';
import {
  Plus,
  MoreVertical,
  HelpCircle,
  Layers,
  MessageSquare,
  CreditCard,
  Truck,
  Contact,
  Megaphone,
  Archive,
} from 'lucide-react';
import { integrationCategories, integrations } from './mock-data';
import { ChannelsSection } from './channels-section';

const CATEGORY_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  all: Layers,
  communication: MessageSquare,
  payments: CreditCard,
  logistics: Truck,
  crm: Contact,
  marketing: Megaphone,
  storage: Archive,
};

export function IntegrationsTab() {
  const [category, setCategory] = useState('all');

  const filtered =
    category === 'all' ? integrations : integrations.filter((i) => i.category === category);

  return (
    <div>
      <ChannelsSection />

      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-5 items-start">
      {/* Categories sidebar */}
      <div className="space-y-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h4 className="text-sm font-bold text-gray-900 mb-3 px-1">Categorías</h4>
          <div className="space-y-1">
            {integrationCategories.map((cat) => {
              const Icon = CATEGORY_ICONS[cat.key];
              const isActive = category === cat.key;
              return (
                <button
                  key={cat.key}
                  onClick={() => setCategory(cat.key)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition ${
                    isActive ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="flex-1 text-left">{cat.label}</span>
                  <span
                    className={`text-xs font-semibold rounded-full px-1.5 py-0.5 min-w-[20px] text-center ${
                      isActive ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {cat.count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="bg-blue-50 rounded-xl border border-blue-100 p-4">
          <div className="flex items-center gap-2 mb-2">
            <HelpCircle className="w-4 h-4 text-blue-600" />
            <h4 className="text-sm font-bold text-gray-900">¿Necesitas ayuda?</h4>
          </div>
          <p className="text-xs text-gray-600 mb-3">
            Conecta tus herramientas favoritas y lleva tu negocio al siguiente nivel.
          </p>
          <button className="w-full py-2 bg-white border border-blue-200 rounded-lg text-sm font-semibold text-blue-700 hover:bg-blue-100/50 transition">
            Ver documentación ↗
          </button>
        </div>
      </div>

      {/* Integrations list */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="flex items-start justify-between gap-4 p-5 border-b border-gray-100">
          <div>
            <h3 className="text-base font-bold text-gray-900">Conecta OmniFlow con tus herramientas favoritas</h3>
            <p className="text-sm text-gray-500 mt-0.5">Automatiza procesos, sincroniza datos y potencia tu negocio.</p>
          </div>
          <button className="flex items-center gap-1.5 px-4 py-2 border border-blue-200 rounded-lg text-sm font-semibold text-blue-700 hover:bg-blue-50 transition shrink-0">
            <Plus className="w-4 h-4" />
            Solicitar integración
          </button>
        </div>

        <div className="divide-y divide-gray-50">
          {filtered.map((integration) => (
            <div key={integration.id} className="flex items-center gap-4 p-5 flex-wrap">
              <span
                className="w-11 h-11 rounded-lg flex items-center justify-center text-xl shrink-0"
                style={{ backgroundColor: `${integration.color}1a` }}
              >
                {integration.emoji}
              </span>

              <div className="min-w-[220px] flex-1">
                <p className="text-sm font-semibold text-gray-900">{integration.name}</p>
                <p className="text-xs text-gray-500 mt-0.5">{integration.description}</p>
              </div>

              <span
                className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full shrink-0 ${
                  integration.status === 'connected'
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'bg-gray-100 text-gray-500'
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    integration.status === 'connected' ? 'bg-emerald-500' : 'bg-gray-400'
                  }`}
                />
                {integration.status === 'connected' ? 'Conectado' : 'Desconectado'}
              </span>

              <div className="text-xs min-w-[140px] shrink-0">
                {integration.detailLabel && <p className="text-gray-400">{integration.detailLabel}</p>}
                <p className={integration.status === 'connected' ? 'text-emerald-600 font-medium' : 'text-gray-500'}>
                  {integration.detailValue}
                </p>
              </div>

              <button
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition shrink-0 ${
                  integration.status === 'connected'
                    ? 'border border-gray-200 text-gray-700 hover:bg-gray-50'
                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                }`}
              >
                {integration.actionLabel}
              </button>

              <button className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 transition shrink-0">
                <MoreVertical className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      </div>
      </div>
    </div>
  );
}
