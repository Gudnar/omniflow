'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { apiGet } from '@/lib/api-client';
import type { AiUsageSummary } from '@/lib/types';

export function UsageTab() {
  const { tokens } = useAuth();
  const [summary, setSummary] = useState<AiUsageSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tokens) return;
    apiGet<AiUsageSummary>('/ai/usage', tokens.accessToken)
      .then(setSummary)
      .catch((err) => console.error('Error fetching AI usage:', err))
      .finally(() => setLoading(false));
  }, [tokens]);

  if (loading || !summary) {
    return (
      <div className="flex items-center justify-center min-h-[30vh]">
        <div className="animate-spin w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xl font-bold text-gray-900">{summary.totals.totalCalls}</p>
          <p className="text-xs text-gray-500">Respuestas generadas</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xl font-bold text-gray-900">{summary.totals.promptTokens.toLocaleString()}</p>
          <p className="text-xs text-gray-500">Tokens de entrada</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xl font-bold text-gray-900">{summary.totals.completionTokens.toLocaleString()}</p>
          <p className="text-xs text-gray-500">Tokens de salida</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xl font-bold text-gray-900">{summary.totals.totalTokens.toLocaleString()}</p>
          <p className="text-xs text-gray-500">Tokens totales</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="text-base font-bold text-gray-900 mb-4">Actividad reciente</h3>
        {summary.recent.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">Aún no hay respuestas generadas por ningún agente.</p>
        ) : (
          <div className="space-y-2">
            {summary.recent.map((entry) => (
              <div key={entry.id} className="flex items-center justify-between text-sm border-b border-gray-50 pb-2">
                <div>
                  <p className="font-medium text-gray-900">{entry.agent.name}</p>
                  <p className="text-xs text-gray-400">{new Date(entry.createdAt).toLocaleString()}</p>
                </div>
                <p className="text-xs text-gray-500">{entry.totalTokens} tokens</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
