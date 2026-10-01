'use client';

import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/lib/toast-context';
import { apiGet, apiPost } from '@/lib/api-client';
import type { Campaign, CampaignStatus, MessageTemplate, Segment, VariableMappingEntry } from '@/lib/types';
import { Modal } from '@/components/ui/modal';
import { CampaignDetailPanel } from './campaign-detail-panel';

const STATUS_LABELS: Record<CampaignStatus, string> = {
  DRAFT: 'Borrador',
  SCHEDULED: 'Programada',
  RUNNING: 'En curso',
  COMPLETED: 'Completada',
  FAILED: 'Fallida',
  CANCELLED: 'Cancelada',
};

const STATUS_COLORS: Record<CampaignStatus, string> = {
  DRAFT: 'bg-gray-100 text-gray-600',
  SCHEDULED: 'bg-amber-50 text-amber-700',
  RUNNING: 'bg-blue-50 text-blue-700',
  COMPLETED: 'bg-emerald-50 text-emerald-700',
  FAILED: 'bg-red-50 text-red-600',
  CANCELLED: 'bg-gray-100 text-gray-500',
};

const CONTACT_FIELDS = [
  { value: 'name', label: 'Nombre' },
  { value: 'phone', label: 'Teléfono' },
  { value: 'email', label: 'Email' },
];

function countPlaceholders(bodyText: string): number[] {
  const matches = bodyText.match(/\{\{(\d+)\}\}/g) ?? [];
  const numbers = Array.from(new Set(matches.map((m) => Number(m.replace(/\D/g, ''))))).sort((a, b) => a - b);
  return numbers;
}

export function CampaignsTab() {
  const { tokens } = useAuth();
  const toast = useToast();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);

  const [form, setForm] = useState({ name: '', description: '', templateId: '', segmentId: '' });
  const [variableMapping, setVariableMapping] = useState<Record<string, VariableMappingEntry>>({});

  const refetch = () => apiGet<Campaign[]>('/campaigns', tokens?.accessToken).then(setCampaigns);

  useEffect(() => {
    if (!tokens) return;
    Promise.all([
      refetch(),
      apiGet<MessageTemplate[]>('/templates?status=APPROVED', tokens.accessToken).then(setTemplates),
      apiGet<Segment[]>('/segments', tokens.accessToken).then(setSegments),
    ])
      .catch((err) => console.error('Error fetching campaigns:', err))
      .finally(() => setLoading(false));
  }, [tokens]);

  const selectedTemplate = templates.find((t) => t.id === form.templateId);
  const placeholders = selectedTemplate ? countPlaceholders(selectedTemplate.bodyText) : [];

  const openCreate = () => {
    setForm({ name: '', description: '', templateId: '', segmentId: '' });
    setVariableMapping({});
    setShowModal(true);
  };

  const setMapping = (key: string, entry: VariableMappingEntry) =>
    setVariableMapping((m) => ({ ...m, [key]: entry }));

  const create = async () => {
    if (!form.name.trim() || !form.templateId || !form.segmentId) return;
    try {
      const campaign = await apiPost<Campaign>('/campaigns', tokens?.accessToken, {
        name: form.name,
        description: form.description || undefined,
        templateId: form.templateId,
        segmentId: form.segmentId,
        variableMapping,
      });
      await refetch();
      setShowModal(false);
      setSelectedId(campaign.id);
      toast.success('Campaña creada correctamente');
    } catch (err: any) {
      toast.error(err.message ?? 'Error al crear la campaña');
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
      <div className="flex justify-end">
        <button
          onClick={openCreate}
          className="flex items-center gap-1.5 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-semibold text-white transition"
        >
          <Plus className="w-4 h-4" />
          Nueva campaña
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_420px] gap-4 items-start">
        <div className="bg-white rounded-xl border border-gray-200">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs font-semibold text-gray-500">
                <th className="px-4 py-3">Nombre</th>
                <th className="px-3 py-3">Plantilla</th>
                <th className="px-3 py-3">Segmento</th>
                <th className="px-3 py-3">Estado</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((c) => (
                <tr
                  key={c.id}
                  onClick={() => setSelectedId(c.id)}
                  className={`border-b border-gray-50 cursor-pointer transition ${
                    selectedId === c.id ? 'bg-blue-50' : 'hover:bg-gray-50'
                  }`}
                >
                  <td className="px-4 py-3 font-medium text-gray-900">{c.name}</td>
                  <td className="px-3 py-3 text-gray-600">{c.template.name}</td>
                  <td className="px-3 py-3 text-gray-600">{c.segment.name}</td>
                  <td className="px-3 py-3">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_COLORS[c.status]}`}>
                      {STATUS_LABELS[c.status]}
                    </span>
                  </td>
                </tr>
              ))}
              {campaigns.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-sm text-gray-400">
                    Sin campañas todavía.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {selectedId && (
          <div className="sticky top-6">
            <CampaignDetailPanel campaignId={selectedId} onClose={() => setSelectedId(null)} onChanged={refetch} />
          </div>
        )}
      </div>

      <Modal open={showModal} onClose={() => setShowModal(false)} title="Nueva campaña">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1.5">Nombre</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1.5">Descripción</label>
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1.5">Plantilla (solo aprobadas)</label>
            <select
              value={form.templateId}
              onChange={(e) => {
                setForm({ ...form, templateId: e.target.value });
                setVariableMapping({});
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
            >
              <option value="">—</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
            {templates.length === 0 && (
              <p className="text-xs text-amber-600 mt-1">No hay plantillas APROBADAS todavía. Envía una a revisión primero.</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1.5">Segmento</label>
            <select value={form.segmentId} onChange={(e) => setForm({ ...form, segmentId: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white">
              <option value="">—</option>
              {segments.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          {selectedTemplate && placeholders.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-1.5">Variables de la plantilla</label>
              <div className="space-y-2">
                {placeholders.map((n) => {
                  const key = String(n);
                  const entry = variableMapping[key] ?? { source: 'contact_field', value: 'name' };
                  return (
                    <div key={key} className="flex items-center gap-2">
                      <span className="text-xs font-mono text-gray-400 w-10 shrink-0">{'{{' + n + '}}'}</span>
                      <select
                        value={entry.source}
                        onChange={(e) => setMapping(key, { source: e.target.value as any, value: e.target.value === 'contact_field' ? 'name' : '' })}
                        className="px-2 py-1.5 border border-gray-300 rounded-lg text-xs bg-white"
                      >
                        <option value="contact_field">Campo del contacto</option>
                        <option value="static">Texto fijo</option>
                      </select>
                      {entry.source === 'contact_field' ? (
                        <select
                          value={entry.value}
                          onChange={(e) => setMapping(key, { source: 'contact_field', value: e.target.value })}
                          className="flex-1 px-2 py-1.5 border border-gray-300 rounded-lg text-xs bg-white"
                        >
                          {CONTACT_FIELDS.map((f) => (
                            <option key={f.value} value={f.value}>{f.label}</option>
                          ))}
                        </select>
                      ) : (
                        <input
                          value={entry.value}
                          onChange={(e) => setMapping(key, { source: 'static', value: e.target.value })}
                          className="flex-1 px-2 py-1.5 border border-gray-300 rounded-lg text-xs"
                          placeholder="Texto fijo"
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={() => setShowModal(false)} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-900 hover:bg-gray-50 font-medium text-sm">
            Cancelar
          </button>
          <button onClick={create} className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold text-sm">
            Crear
          </button>
        </div>
      </Modal>
    </div>
  );
}
