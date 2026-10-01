'use client';

import { useEffect, useState } from 'react';
import { X, Send } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/lib/toast-context';
import { apiGet, apiPost } from '@/lib/api-client';
import type { Campaign, CampaignStatus } from '@/lib/types';

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

export function CampaignDetailPanel({
  campaignId,
  onClose,
  onChanged,
}: {
  campaignId: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { tokens } = useAuth();
  const toast = useToast();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [busy, setBusy] = useState(false);

  const refetch = () => apiGet<Campaign>(`/campaigns/${campaignId}`, tokens?.accessToken).then(setCampaign);

  useEffect(() => {
    refetch().catch((err) => console.error('Error fetching campaign:', err));
    // Poll while a send might be in flight, same pattern as the workflow
    // executions panel.
    const interval = setInterval(() => refetch().catch(() => {}), 4000);
    return () => clearInterval(interval);
  }, [campaignId, tokens]);

  const send = async () => {
    if (!confirm('¿Enviar esta campaña ahora?')) return;
    setBusy(true);
    try {
      await apiPost(`/campaigns/${campaignId}/send`, tokens?.accessToken, {});
      await refetch();
      onChanged();
      toast.success('Campaña enviada correctamente');
    } catch (err: any) {
      toast.error(err.message ?? 'Error al enviar la campaña');
    } finally {
      setBusy(false);
    }
  };

  if (!campaign) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-8 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full" />
      </div>
    );
  }

  const canSend = campaign.status === 'DRAFT' || campaign.status === 'SCHEDULED';
  const counts = campaign.recipientCounts ?? { PENDING: 0, SENT: 0, FAILED: 0 };
  const total = counts.PENDING + counts.SENT + counts.FAILED;

  return (
    <div className="bg-white rounded-xl border border-gray-200 flex flex-col overflow-hidden max-h-[calc(100vh-8rem)]">
      <div className="flex items-center justify-between p-5 border-b border-gray-100">
        <div>
          <p className="text-base font-bold text-gray-900">{campaign.name}</p>
          <p className="text-xs text-gray-400">{campaign.template.name} → {campaign.segment.name}</p>
        </div>
        <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 text-gray-400 transition shrink-0">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-6">
        <div className="flex items-center justify-between">
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${STATUS_COLORS[campaign.status]}`}>
            {STATUS_LABELS[campaign.status]}
          </span>
          {canSend && (
            <button
              onClick={send}
              disabled={busy}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm font-semibold"
            >
              <Send className="w-3.5 h-3.5" /> Enviar ahora
            </button>
          )}
        </div>

        {total > 0 && (
          <div>
            <h4 className="text-sm font-bold text-gray-900 mb-3">Progreso de envío</h4>
            <div className="w-full h-2 rounded-full bg-gray-100 overflow-hidden flex">
              <div className="bg-emerald-500 h-full" style={{ width: `${(counts.SENT / total) * 100}%` }} />
              <div className="bg-red-500 h-full" style={{ width: `${(counts.FAILED / total) * 100}%` }} />
            </div>
            <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
              <span>{counts.SENT} enviados</span>
              <span>{counts.FAILED} fallidos</span>
              <span>{counts.PENDING} pendientes</span>
            </div>
          </div>
        )}

        {campaign.description && (
          <div>
            <h4 className="text-sm font-bold text-gray-900 mb-1.5">Descripción</h4>
            <p className="text-sm text-gray-600">{campaign.description}</p>
          </div>
        )}

        {campaign.scheduledAt && (
          <div>
            <h4 className="text-sm font-bold text-gray-900 mb-1.5">Programada para</h4>
            <p className="text-sm text-gray-600">{new Date(campaign.scheduledAt).toLocaleString()}</p>
          </div>
        )}
      </div>
    </div>
  );
}
