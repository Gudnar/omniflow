'use client';

import { useEffect, useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import { apiGet } from '@/lib/api-client';
import type { EcommerceStore, StorefrontPurchase } from '@/lib/types';
import { waMeLink } from './shared';

// Identical on both the ecommerce and the booking storefront pages — "Mis
// compras y reservas" merges Orders + Appointments for this same contact
// (GET .../purchases), so a customer sees their whole history regardless of
// which of the two pages they're on.
export function StorefrontInfoSheet({
  show,
  onClose,
  store,
  token,
}: {
  show: boolean;
  onClose: () => void;
  store: EcommerceStore;
  token: string;
}) {
  const [purchases, setPurchases] = useState<StorefrontPurchase[] | null>(null);

  useEffect(() => {
    if (!show || purchases !== null || !token) return;
    apiGet<StorefrontPurchase[]>(`/storefront/sessions/${token}/purchases`)
      .then(setPurchases)
      .catch((err) => console.error('Error fetching purchases:', err));
  }, [show, purchases, token]);

  if (!show) return null;

  const infoSections = store.sections
    .filter((s) => s.enabled && s.type === 'TEXT_BLOCK')
    .sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-white rounded-t-[20px] max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <h3 className="font-extrabold">{store.name}</h3>
          <button onClick={onClose}>
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {infoSections.map((section) => (
            <div key={section.id}>
              {section.title && <h4 className="font-bold text-sm mb-1">{section.title}</h4>}
              {section.subtitle && <p className="text-sm text-gray-500">{section.subtitle}</p>}
            </div>
          ))}
          {infoSections.length === 0 && !store.whatsappPhone && (
            <p className="text-sm text-gray-400">Sin información adicional.</p>
          )}

          <div className="pt-2 border-t border-gray-100">
            <h4 className="font-bold text-sm mb-2">Mis compras y reservas</h4>
            {purchases === null && (
              <div className="flex justify-center py-6">
                <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
              </div>
            )}
            {purchases !== null && purchases.length === 0 && (
              <p className="text-sm text-gray-400">Todavía no tienes compras ni reservas.</p>
            )}
            {purchases !== null && purchases.length > 0 && (
              <div className="space-y-2">
                {purchases.map((p) => (
                  <div key={`${p.kind}-${p.id}`} className="flex items-center justify-between text-sm border border-gray-100 rounded-xl p-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900 truncate">{p.label}</p>
                      <p className="text-xs text-gray-400">
                        {p.kind === 'order' ? 'Pedido' : 'Cita'} ·{' '}
                        {new Date(p.date).toLocaleDateString('es-BO', { dateStyle: 'medium' })} · {p.status}
                      </p>
                    </div>
                    <p className="font-bold text-gray-900 flex-shrink-0 ml-2">
                      {p.currency} {p.total.toFixed(2)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {store.whatsappPhone && (
            <a
              href={waMeLink(store.whatsappPhone, `Hola, tengo una consulta sobre ${store.name}`)}
              className="inline-block w-full py-3 rounded-2xl text-white font-extrabold text-center"
              style={{ backgroundColor: '#25D366' }}
            >
              Escribir por WhatsApp
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
