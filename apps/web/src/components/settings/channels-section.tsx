'use client';

import { useEffect, useState } from 'react';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/lib/toast-context';
import { apiGet, apiPost, apiDelete, ApiError } from '@/lib/api-client';
import { Modal } from '@/components/ui/modal';

type ChannelKey = 'whatsapp' | 'instagram' | 'facebook' | 'facebook-comments' | 'tiktok';

interface ChannelDef {
  key: ChannelKey;
  name: string;
  description: string;
  color: string;
  emoji: string;
}

const CHANNEL_DEFS: ChannelDef[] = [
  {
    key: 'whatsapp',
    name: 'WhatsApp Business API',
    description: 'Conecta tu número oficial para enviar y recibir mensajes.',
    color: '#22c55e',
    emoji: '💬',
  },
  {
    key: 'instagram',
    name: 'Instagram Direct',
    description: 'Conecta tu cuenta profesional de Instagram para gestionar DMs.',
    color: '#c026d3',
    emoji: '📸',
  },
  {
    key: 'facebook',
    name: 'Facebook Messenger',
    description: 'Conecta tu Página de Facebook para gestionar mensajes de Messenger.',
    color: '#2563eb',
    emoji: '👍',
  },
  {
    key: 'facebook-comments',
    name: 'Facebook Comentarios',
    description: 'Conecta tu Página de Facebook para responder comentarios de tus publicaciones.',
    color: '#f97316',
    emoji: '💬',
  },
  {
    key: 'tiktok',
    name: 'TikTok Business Messaging',
    description: 'Conecta tu cuenta de negocio de TikTok para gestionar mensajes.',
    color: '#111827',
    emoji: '🎵',
  },
];

interface MetaConnectionData {
  externalAccountId: string;
  displayName: string;
  wabaId?: string | null;
  status: 'CONNECTED' | 'DISCONNECTED';
}

interface TikTokConnectionData {
  businessId: string;
  clientKey: string;
  status: 'CONNECTED' | 'DISCONNECTED';
}

type ConnectionState =
  | { loading: true }
  | { loading: false; connected: false }
  | { loading: false; connected: true; label: string; status: string; data: MetaConnectionData | TikTokConnectionData };

function initialFormFor(key: ChannelKey): Record<string, string> {
  return key === 'tiktok'
    ? { businessId: '', clientKey: '', accessToken: '', refreshToken: '' }
    : { externalAccountId: '', accessToken: '', displayName: '', wabaId: '' };
}

// Pre-fills everything EXCEPT the secret token(s), which the API never
// returns in full (only masked) — leaving those blank plus the "editing"
// flag is what lets submitConnect() below know to omit them so the backend
// keeps the existing value instead of overwriting it with an empty string.
function editFormFor(key: ChannelKey, data: MetaConnectionData | TikTokConnectionData): Record<string, string> {
  if (key === 'tiktok') {
    const d = data as TikTokConnectionData;
    return { businessId: d.businessId, clientKey: d.clientKey, accessToken: '', refreshToken: '' };
  }
  const d = data as MetaConnectionData;
  return { externalAccountId: d.externalAccountId, accessToken: '', displayName: d.displayName, wabaId: d.wabaId ?? '' };
}

export function ChannelsSection() {
  const { tokens } = useAuth();
  const toast = useToast();
  const [states, setStates] = useState<Record<ChannelKey, ConnectionState>>({
    whatsapp: { loading: true },
    instagram: { loading: true },
    facebook: { loading: true },
    'facebook-comments': { loading: true },
    tiktok: { loading: true },
  });
  const [modalChannel, setModalChannel] = useState<ChannelKey | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  const refetch = async (key: ChannelKey) => {
    setStates((prev) => ({ ...prev, [key]: { loading: true } }));
    try {
      if (key === 'tiktok') {
        const data = await apiGet<TikTokConnectionData>('/channels/tiktok', tokens?.accessToken);
        setStates((prev) => ({
          ...prev,
          [key]:
            data.status === 'CONNECTED'
              ? { loading: false, connected: true, label: data.businessId, status: data.status, data }
              : { loading: false, connected: false },
        }));
      } else {
        const data = await apiGet<MetaConnectionData>(`/channels/${key}`, tokens?.accessToken);
        setStates((prev) => ({
          ...prev,
          [key]:
            data.status === 'CONNECTED'
              ? { loading: false, connected: true, label: data.displayName, status: data.status, data }
              : { loading: false, connected: false },
        }));
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setStates((prev) => ({ ...prev, [key]: { loading: false, connected: false } }));
      } else {
        console.error(`Error fetching ${key} connection:`, err);
        setStates((prev) => ({ ...prev, [key]: { loading: false, connected: false } }));
      }
    }
  };

  useEffect(() => {
    if (!tokens) return;
    CHANNEL_DEFS.forEach((c) => refetch(c.key));
  }, [tokens]);

  const openConnectModal = (key: ChannelKey) => {
    setForm(initialFormFor(key));
    setIsEditing(false);
    setTestResult(null);
    setModalChannel(key);
  };

  const openEditModal = (key: ChannelKey, data: MetaConnectionData | TikTokConnectionData) => {
    setForm(editFormFor(key, data));
    setIsEditing(true);
    setTestResult(null);
    setModalChannel(key);
  };

  // Blank secret fields mean "keep the current value" while editing —
  // sending them as empty strings would overwrite the real token, so
  // they're left out of the payload entirely (the backend then falls back
  // to what's already stored). Shared by "Guardar" and "Probar conexión" so
  // a test always reflects exactly what would be saved.
  const buildPayload = (): Record<string, string> => {
    const { accessToken, refreshToken, ...rest } = form;
    const payload: Record<string, string> = { ...rest };
    if (accessToken.trim()) payload.accessToken = accessToken;
    if (modalChannel === 'tiktok' && refreshToken?.trim()) payload.refreshToken = refreshToken;
    if (modalChannel !== 'tiktok') payload.wabaId = modalChannel === 'whatsapp' ? form.wabaId : (undefined as any);
    return payload;
  };

  const submitConnect = async () => {
    if (!modalChannel) return;
    try {
      await apiPost(`/channels/${modalChannel}/connect`, tokens?.accessToken, buildPayload());
      setModalChannel(null);
      await refetch(modalChannel);
      toast.success(isEditing ? 'Canal actualizado correctamente' : 'Canal conectado correctamente');
    } catch (err: any) {
      toast.error(err.message ?? 'No se pudo guardar el canal');
    }
  };

  const testConnection = async () => {
    if (!modalChannel || testing) return;
    setTesting(true);
    setTestResult(null);
    try {
      const result = await apiPost<{ ok: boolean; message: string }>(`/channels/${modalChannel}/test`, tokens?.accessToken, buildPayload());
      setTestResult(result);
    } catch (err: any) {
      setTestResult({ ok: false, message: err.message ?? 'No se pudo probar la conexión' });
    } finally {
      setTesting(false);
    }
  };

  const disconnect = async (key: ChannelKey) => {
    if (!confirm('¿Desconectar este canal?')) return;
    try {
      await apiDelete(`/channels/${key}`, tokens?.accessToken);
      await refetch(key);
      toast.success('Canal desconectado correctamente');
    } catch (err: any) {
      toast.error(err.message ?? 'No se pudo desconectar el canal');
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 mb-5">
      <div className="p-5 border-b border-gray-100">
        <h3 className="text-base font-bold text-gray-900">Canales de mensajería</h3>
        <p className="text-sm text-gray-500 mt-0.5">Conecta WhatsApp, Instagram, Facebook y TikTok para gestionar tus conversaciones.</p>
      </div>

      <div className="divide-y divide-gray-50">
        {CHANNEL_DEFS.map((def) => {
          const state = states[def.key];
          return (
            <div key={def.key} className="flex items-center gap-4 p-5 flex-wrap">
              <span
                className="w-11 h-11 rounded-lg flex items-center justify-center text-xl shrink-0"
                style={{ backgroundColor: `${def.color}1a` }}
              >
                {def.emoji}
              </span>

              <div className="min-w-[220px] flex-1">
                <p className="text-sm font-semibold text-gray-900">{def.name}</p>
                <p className="text-xs text-gray-500 mt-0.5">{def.description}</p>
              </div>

              {state.loading ? (
                <span className="text-xs text-gray-400">Cargando...</span>
              ) : (
                <>
                  <span
                    className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full shrink-0 ${
                      state.connected ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${state.connected ? 'bg-emerald-500' : 'bg-gray-400'}`} />
                    {state.connected ? 'Conectado' : 'Desconectado'}
                  </span>

                  <div className="text-xs min-w-[140px] shrink-0">
                    <p className={state.connected ? 'text-emerald-600 font-medium' : 'text-gray-500'}>
                      {state.connected ? state.label : 'No conectado'}
                    </p>
                  </div>

                  {state.connected ? (
                    <div className="flex gap-2 shrink-0">
                      <button
                        onClick={() => openEditModal(def.key, state.data)}
                        className="px-4 py-2 rounded-lg text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white transition"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => disconnect(def.key)}
                        className="px-4 py-2 rounded-lg text-sm font-semibold border border-gray-200 text-gray-700 hover:bg-gray-50 transition"
                      >
                        Desconectar
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => openConnectModal(def.key)}
                      className="px-4 py-2 rounded-lg text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white transition shrink-0"
                    >
                      Conectar
                    </button>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>

      <Modal
        open={modalChannel !== null}
        onClose={() => setModalChannel(null)}
        title={`${isEditing ? 'Editar' : 'Conectar'} ${modalChannel ? CHANNEL_DEFS.find((c) => c.key === modalChannel)?.name : ''}`}
      >
        {modalChannel && (
          <div className="space-y-4">
            {modalChannel === 'tiktok' ? (
              <>
                <FormField label="Business ID" value={form.businessId} onChange={(v) => setForm({ ...form, businessId: v })} />
                <FormField label="Client Key" value={form.clientKey} onChange={(v) => setForm({ ...form, clientKey: v })} />
                <FormField
                  label="Access Token"
                  value={form.accessToken}
                  onChange={(v) => setForm({ ...form, accessToken: v })}
                  placeholder={isEditing ? 'Dejar vacío para mantener el actual' : undefined}
                />
                <FormField
                  label="Refresh Token"
                  value={form.refreshToken}
                  onChange={(v) => setForm({ ...form, refreshToken: v })}
                  placeholder={isEditing ? 'Dejar vacío para mantener el actual' : undefined}
                />
              </>
            ) : (
              <>
                <FormField
                  label={modalChannel === 'whatsapp' ? 'Phone Number ID' : modalChannel === 'instagram' ? 'Instagram Business Account ID' : 'Page ID'}
                  value={form.externalAccountId}
                  onChange={(v) => setForm({ ...form, externalAccountId: v })}
                />
                <FormField
                  label="Access Token"
                  value={form.accessToken}
                  onChange={(v) => setForm({ ...form, accessToken: v })}
                  placeholder={isEditing ? 'Dejar vacío para mantener el actual' : undefined}
                />
                <FormField label="Nombre para mostrar" value={form.displayName} onChange={(v) => setForm({ ...form, displayName: v })} />
                {modalChannel === 'whatsapp' && (
                  <FormField label="WABA ID" value={form.wabaId} onChange={(v) => setForm({ ...form, wabaId: v })} />
                )}
              </>
            )}
          </div>
        )}

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
            onClick={() => setModalChannel(null)}
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
            onClick={submitConnect}
            className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold text-sm"
          >
            {isEditing ? 'Guardar cambios' : 'Conectar'}
          </button>
        </div>
      </Modal>
    </div>
  );
}

function FormField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-900 mb-1.5">{label}</label>
      <input
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>
  );
}
