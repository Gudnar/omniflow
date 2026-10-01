'use client';

import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Bot, BookOpen } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/lib/toast-context';
import { apiGet, apiPost, apiPatch, apiDelete } from '@/lib/api-client';
import { Modal } from '@/components/ui/modal';
import type { AiAgent, AiModel, BackendChannel, KnowledgeDocument } from '@/lib/types';

const CHANNEL_LABELS: Record<BackendChannel, string> = {
  WHATSAPP: 'WhatsApp',
  INSTAGRAM: 'Instagram',
  FACEBOOK: 'Facebook',
  MESSENGER: 'Messenger',
  TIKTOK: 'TikTok',
  WEBCHAT: 'Chat web',
};

const ALL_CHANNELS = Object.keys(CHANNEL_LABELS) as BackendChannel[];

function emptyForm() {
  return {
    id: null as string | null,
    name: '',
    modelId: '',
    status: 'INACTIVE' as 'ACTIVE' | 'INACTIVE',
    temperature: 0.7,
    goal: '',
    personality: '',
    language: 'es',
    channels: [] as BackendChannel[],
    escalationKeywords: '',
    maxTokens: 500,
    knowledgeDocumentIds: [] as string[],
  };
}

export function AgentsTab() {
  const { tokens } = useAuth();
  const toast = useToast();
  const [agents, setAgents] = useState<AiAgent[]>([]);
  const [models, setModels] = useState<AiModel[]>([]);
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm());

  const refetch = () => apiGet<AiAgent[]>('/ai/agents', tokens?.accessToken).then(setAgents);

  useEffect(() => {
    if (!tokens) return;
    Promise.all([
      refetch(),
      apiGet<AiModel[]>('/ai/models', tokens.accessToken).then(setModels),
      apiGet<KnowledgeDocument[]>('/knowledge/documents', tokens.accessToken).then(setDocuments),
    ])
      .catch((err) => console.error('Error fetching AI agents:', err))
      .finally(() => setLoading(false));
  }, [tokens]);

  const openCreate = () => {
    setForm({ ...emptyForm(), modelId: models[0]?.id ?? '' });
    setShowModal(true);
  };

  const openEdit = (agent: AiAgent) => {
    setForm({
      id: agent.id,
      name: agent.name,
      modelId: agent.modelId,
      status: agent.status,
      temperature: agent.temperature,
      goal: agent.goal ?? '',
      personality: agent.personality ?? '',
      language: agent.language,
      channels: agent.channels,
      escalationKeywords: agent.escalationKeywords.join(', '),
      maxTokens: agent.maxTokens,
      knowledgeDocumentIds: agent.knowledgeDocuments.map((k) => k.document.id),
    });
    setShowModal(true);
  };

  const toggleChannel = (channel: BackendChannel) => {
    setForm((f) => ({
      ...f,
      channels: f.channels.includes(channel) ? f.channels.filter((c) => c !== channel) : [...f.channels, channel],
    }));
  };

  const toggleDocument = (documentId: string) => {
    setForm((f) => ({
      ...f,
      knowledgeDocumentIds: f.knowledgeDocumentIds.includes(documentId)
        ? f.knowledgeDocumentIds.filter((id) => id !== documentId)
        : [...f.knowledgeDocumentIds, documentId],
    }));
  };

  const save = async () => {
    if (!form.name.trim()) {
      toast.error('El nombre del agente es obligatorio');
      return;
    }
    if (!form.modelId) {
      toast.error('Selecciona un modelo');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        modelId: form.modelId,
        status: form.status,
        temperature: form.temperature,
        goal: form.goal || undefined,
        personality: form.personality || undefined,
        language: form.language,
        channels: form.channels,
        escalationKeywords: form.escalationKeywords
          .split(',')
          .map((k) => k.trim())
          .filter(Boolean),
        maxTokens: form.maxTokens,
        knowledgeDocumentIds: form.knowledgeDocumentIds,
      };
      if (form.id) {
        await apiPatch(`/ai/agents/${form.id}`, tokens?.accessToken, payload);
      } else {
        await apiPost('/ai/agents', tokens?.accessToken, payload);
      }
      await refetch();
      setShowModal(false);
      toast.success('Agente guardado correctamente');
    } catch (err: any) {
      toast.error(err.message ?? 'No se pudo guardar el agente');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (agent: AiAgent) => {
    if (!confirm(`¿Eliminar el agente "${agent.name}"?`)) return;
    try {
      await apiDelete(`/ai/agents/${agent.id}`, tokens?.accessToken);
      await refetch();
      toast.success('Agente eliminado correctamente');
    } catch (err: any) {
      toast.error(err.message ?? 'No se pudo eliminar el agente');
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
    <div className="space-y-4">
      <div className="flex justify-between items-start gap-3">
        <p className="text-sm text-gray-500 max-w-2xl">
          Un agente responde automáticamente en los canales que le asignes, siempre que la conversación no esté ya
          tomada por un humano. Solo puede haber un agente activo por canal.
        </p>
        <button
          onClick={openCreate}
          disabled={models.length === 0}
          className="shrink-0 flex items-center gap-1.5 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg text-sm font-semibold text-white transition"
        >
          <Plus className="w-4 h-4" />
          Nuevo agente
        </button>
      </div>

      {models.length === 0 && (
        <p className="text-sm text-amber-700 bg-amber-50 border border-amber-100 rounded-lg p-3">
          No hay ningún modelo disponible todavía — conecta un proveedor (pestaña "Proveedores") antes de crear un
          agente.
        </p>
      )}

      {agents.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 flex flex-col items-center justify-center text-center">
          <Bot className="w-8 h-8 text-gray-300 mb-3" />
          <p className="text-sm text-gray-400">Aún no configuraste ningún agente.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {agents.map((agent) => (
            <div key={agent.id} className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div>
                  <p className="text-sm font-bold text-gray-900">{agent.name}</p>
                  <p className="text-xs text-gray-400">{agent.model.label}</p>
                </div>
                <span
                  className={`text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 ${
                    agent.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  {agent.status === 'ACTIVE' ? 'Activo' : 'Inactivo'}
                </span>
              </div>

              <div className="flex flex-wrap gap-1.5 mb-2">
                {agent.channels.length === 0 && <span className="text-xs text-gray-400">Sin canales asignados</span>}
                {agent.channels.map((c) => (
                  <span key={c} className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                    {CHANNEL_LABELS[c]}
                  </span>
                ))}
              </div>

              {agent.knowledgeDocuments.length > 0 && (
                <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-3">
                  <BookOpen className="w-3.5 h-3.5" />
                  {agent.knowledgeDocuments.length} documento{agent.knowledgeDocuments.length === 1 ? '' : 's'} de
                  conocimiento
                </div>
              )}

              <div className="flex items-center justify-end gap-1">
                <button onClick={() => openEdit(agent)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => remove(agent)} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={showModal} onClose={() => setShowModal(false)} title={form.id ? 'Editar agente' : 'Nuevo agente'} size="lg">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-1.5">Nombre</label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ej: Asistente de ventas"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-1.5">Modelo</label>
              <select
                value={form.modelId}
                onChange={(e) => setForm({ ...form, modelId: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
              >
                {models.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.provider.label} · {m.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1.5">Objetivo</label>
            <input
              value={form.goal}
              onChange={(e) => setForm({ ...form, goal: e.target.value })}
              placeholder="Ej: Ayudar a los clientes a elegir un producto y cerrar la venta"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1.5">Personalidad</label>
            <textarea
              value={form.personality}
              onChange={(e) => setForm({ ...form, personality: e.target.value })}
              rows={2}
              placeholder="Ej: Cercano, amable y directo, sin usar jerga técnica"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-1.5">Idioma</label>
              <input
                value={form.language}
                onChange={(e) => setForm({ ...form, language: e.target.value })}
                placeholder="es"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-1.5">Temperatura</label>
              <input
                type="number"
                step="0.1"
                min={0}
                max={2}
                value={form.temperature}
                onChange={(e) => setForm({ ...form, temperature: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-1.5">Máx. tokens</label>
              <input
                type="number"
                min={50}
                max={4000}
                value={form.maxTokens}
                onChange={(e) => setForm({ ...form, maxTokens: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1.5">Canales</label>
            <div className="flex flex-wrap gap-2">
              {ALL_CHANNELS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => toggleChannel(c)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${
                    form.channels.includes(c)
                      ? 'bg-blue-600 border-blue-600 text-white'
                      : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {CHANNEL_LABELS[c]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1.5">Base de conocimiento</label>
            {documents.length === 0 ? (
              <p className="text-xs text-gray-400">
                Aún no cargaste ningún documento — hazlo desde la pestaña "Base de conocimiento".
              </p>
            ) : (
              <div className="space-y-1.5 max-h-32 overflow-y-auto border border-gray-200 rounded-lg p-2">
                {documents.map((doc) => (
                  <label key={doc.id} className="flex items-center gap-2 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      checked={form.knowledgeDocumentIds.includes(doc.id)}
                      onChange={() => toggleDocument(doc.id)}
                    />
                    {doc.title}
                    {doc.status === 'INACTIVE' && <span className="text-xs text-gray-400">(inactivo)</span>}
                  </label>
                ))}
              </div>
            )}
            <p className="text-xs text-gray-400 mt-1">
              El agente solo consultará los documentos que marques aquí, y solo si están activos.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1.5">
              Palabras de escalamiento (separadas por coma)
            </label>
            <input
              value={form.escalationKeywords}
              onChange={(e) => setForm({ ...form, escalationKeywords: e.target.value })}
              placeholder="reembolso, queja, hablar con una persona"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
            <p className="text-xs text-gray-400 mt-1">
              Si el mensaje del cliente contiene alguna de estas palabras, el agente no responde y deja la
              conversación para un humano.
            </p>
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={form.status === 'ACTIVE'}
              onChange={(e) => setForm({ ...form, status: e.target.checked ? 'ACTIVE' : 'INACTIVE' })}
            />
            Agente activo (responderá automáticamente en los canales seleccionados)
          </label>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={() => setShowModal(false)}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-900 hover:bg-gray-50 font-medium text-sm"
          >
            Cancelar
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg font-semibold text-sm"
          >
            Guardar
          </button>
        </div>
      </Modal>
    </div>
  );
}
