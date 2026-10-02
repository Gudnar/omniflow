'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/lib/toast-context';
import { apiGet, apiPost, apiDelete } from '@/lib/api-client';
import { Modal } from '@/components/ui/modal';
import type { AiProvider } from '@/lib/types';

export function ProvidersTab() {
  const { tokens } = useAuth();
  const toast = useToast();
  const [providers, setProviders] = useState<AiProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalProvider, setModalProvider] = useState<AiProvider | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  const refetch = () => {
    if (!tokens) return;
    apiGet<AiProvider[]>('/ai/providers', tokens.accessToken)
      .then(setProviders)
      .catch((err) => console.error('Error fetching AI providers:', err))
      .finally(() => setLoading(false));
  };

  useEffect(refetch, [tokens]);

  const openConfigureModal = (provider: AiProvider) => {
    setApiKey('');
    setTestResult(null);
    setModalProvider(provider);
  };

  // A blank key means "keep the current value" while editing — same
  // "don't overwrite a stored secret with an empty string" convention as
  // channels-section.tsx's buildPayload.
  const testConnection = async () => {
    if (!modalProvider || testing) return;
    setTesting(true);
    setTestResult(null);
    try {
      const result = await apiPost<{ ok: boolean; message: string }>(
        `/ai/providers/${modalProvider.id}/credential/test`,
        tokens?.accessToken,
        apiKey.trim() ? { apiKey } : {},
      );
      setTestResult(result);
    } catch (err: any) {
      setTestResult({ ok: false, message: err.message ?? 'No se pudo probar la conexión' });
    } finally {
      setTesting(false);
    }
  };

  const save = async () => {
    if (!modalProvider || !apiKey.trim()) return;
    try {
      await apiPost(`/ai/providers/${modalProvider.id}/credential`, tokens?.accessToken, { apiKey });
      setModalProvider(null);
      refetch();
      toast.success('Proveedor configurado correctamente');
    } catch (err: any) {
      toast.error(err.message ?? 'No se pudo guardar la credencial');
    }
  };

  const remove = async (provider: AiProvider) => {
    if (!confirm(`¿Quitar la credencial de ${provider.label}? Los agentes que la usan dejarán de responder.`)) return;
    try {
      await apiDelete(`/ai/providers/${provider.id}/credential`, tokens?.accessToken);
      refetch();
      toast.success('Credencial eliminada');
    } catch (err: any) {
      toast.error(err.message ?? 'No se pudo eliminar la credencial');
    }
  };

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
        Configura tu propia API key por proveedor. Solo un proveedor conectado ofrece modelos seleccionables al crear
        un agente, y un agente sin credencial configurada no responderá.
      </p>

      <div className="space-y-2">
        {providers.map((p) => (
          <div key={p.id} className="flex items-center justify-between border border-gray-100 rounded-lg p-3 gap-3">
            <span className="text-sm font-semibold text-gray-900">{p.label}</span>
            <div className="flex items-center gap-2 shrink-0">
              {p.connected ? (
                <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Conectado
                </span>
              ) : (
                <span className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 bg-gray-100 px-2.5 py-1 rounded-full">
                  <XCircle className="w-3.5 h-3.5" /> No configurado
                </span>
              )}
              <button
                onClick={() => openConfigureModal(p)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white transition"
              >
                Configurar
              </button>
              {p.connected && (
                <button
                  onClick={() => remove(p)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-gray-200 text-gray-700 hover:bg-gray-50 transition"
                >
                  Quitar
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      <Modal open={modalProvider !== null} onClose={() => setModalProvider(null)} title={`Configurar ${modalProvider?.label ?? ''}`}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1.5">API Key</label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={modalProvider?.connected ? 'Dejar vacío para mantener la actual' : 'sk-...'}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1.5">
              Esta key se usa solo para los agentes de tu negocio y se guarda encriptada.
            </p>
          </div>
        </div>

        {testResult && (
          <div
            className={`mt-4 flex items-start gap-2 px-3 py-2.5 rounded-lg text-sm ${
              testResult.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
            }`}
          >
            {testResult.ok ? <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" /> : <XCircle className="w-4 h-4 mt-0.5 shrink-0" />}
            <span>{testResult.message}</span>
          </div>
        )}

        <div className="flex gap-3 mt-6">
          <button
            onClick={() => setModalProvider(null)}
            className="px-4 py-2 border border-gray-300 rounded-lg text-gray-900 hover:bg-gray-50 font-medium text-sm"
          >
            Cancelar
          </button>
          <button
            onClick={testConnection}
            disabled={testing}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-gray-900 hover:bg-gray-50 font-medium text-sm disabled:opacity-60"
          >
            {testing && <Loader2 className="w-4 h-4 animate-spin" />}
            Probar conexión
          </button>
          <button
            onClick={save}
            disabled={!apiKey.trim()}
            className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold text-sm disabled:opacity-60"
          >
            Guardar
          </button>
        </div>
      </Modal>
    </div>
  );
}
