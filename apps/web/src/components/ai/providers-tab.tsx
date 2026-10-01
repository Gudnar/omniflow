'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { apiGet } from '@/lib/api-client';
import type { AiProvider } from '@/lib/types';

export function ProvidersTab() {
  const { tokens } = useAuth();
  const [providers, setProviders] = useState<AiProvider[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tokens) return;
    apiGet<AiProvider[]>('/ai/providers', tokens.accessToken)
      .then(setProviders)
      .catch((err) => console.error('Error fetching AI providers:', err))
      .finally(() => setLoading(false));
  }, [tokens]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[30vh]">
        <div className="animate-spin w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full" />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <h3 className="text-base font-bold text-gray-900 mb-1">Proveedores de IA</h3>
      <p className="text-sm text-gray-500 mb-4">
        Estado de conexión de cada proveedor de modelos de lenguaje. Solo un proveedor conectado ofrece modelos
        seleccionables al crear un agente.
      </p>

      <div className="space-y-2">
        {providers.map((p) => (
          <div key={p.id} className="flex items-center justify-between border border-gray-100 rounded-lg p-3">
            <span className="text-sm font-semibold text-gray-900">{p.label}</span>
            {p.connected ? (
              <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full">
                <CheckCircle2 className="w-3.5 h-3.5" /> Conectado
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 bg-gray-100 px-2.5 py-1 rounded-full">
                <XCircle className="w-3.5 h-3.5" /> No configurado
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
