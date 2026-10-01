'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { apiGet } from '@/lib/api-client';
import type { Flow, FlowStatus } from '@/lib/types';
import { FlowCanvas } from '@/components/flows/flow-canvas';
import { ExecutionsPanel } from '@/components/flows/executions-panel';

const STATUS_LABELS: Record<FlowStatus, string> = {
  DRAFT: 'Borrador',
  ACTIVE: 'Activo',
  INACTIVE: 'Inactivo',
};

const STATUS_COLORS: Record<FlowStatus, string> = {
  DRAFT: 'bg-gray-100 text-gray-600',
  ACTIVE: 'bg-emerald-50 text-emerald-700',
  INACTIVE: 'bg-amber-50 text-amber-700',
};

const TABS = ['Editor', 'Ejecuciones'] as const;
type Tab = (typeof TABS)[number];

export default function FlowEditorPage() {
  const params = useParams();
  const router = useRouter();
  const { user, isLoading, tokens } = useAuth();
  const flowId = params.id as string;

  const [flow, setFlow] = useState<Flow | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('Editor');

  useEffect(() => {
    if (!isLoading && !user) router.push('/login');
  }, [isLoading, user, router]);

  useEffect(() => {
    if (!tokens) return;
    apiGet<Flow>(`/workflows/flows/${flowId}`, tokens.accessToken)
      .then(setFlow)
      .catch((err) => console.error('Error fetching flow:', err))
      .finally(() => setLoading(false));
  }, [tokens, flowId]);

  if (isLoading || !user || loading || !flow) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full" />
      </div>
    );
  }

  return (
    <div className="max-w-[1800px] mx-auto px-4 sm:px-6 py-6 space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={() => router.push('/dashboard/flows')} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-gray-900">{flow.name}</h1>
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_COLORS[flow.status]}`}>
              {STATUS_LABELS[flow.status]}
            </span>
          </div>
          {flow.description && <p className="text-sm text-gray-500 mt-0.5">{flow.description}</p>}
        </div>
      </div>

      <div className="flex items-center gap-2 border-b border-gray-200">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-2.5 text-sm font-medium border-b-2 transition ${
              tab === t ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'Editor' && <FlowCanvas flow={flow} onSaved={setFlow} />}
      {tab === 'Ejecuciones' && <ExecutionsPanel flowId={flow.id} />}
    </div>
  );
}
