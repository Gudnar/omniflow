'use client';

import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import type { BackendChannel } from '@/lib/types';

const CHANNEL_LABELS: Record<BackendChannel, string> = {
  WHATSAPP: 'WhatsApp',
  INSTAGRAM: 'Instagram',
  FACEBOOK: 'Facebook',
  TIKTOK: 'TikTok',
  MESSENGER: 'Messenger',
  WEBCHAT: 'Chat web',
};

const CHANNEL_COLORS: Record<BackendChannel, string> = {
  WHATSAPP: '#22c55e',
  INSTAGRAM: '#c026d3',
  FACEBOOK: '#2563eb',
  TIKTOK: '#111827',
  MESSENGER: '#3b82f6',
  WEBCHAT: '#6366f1',
};

export function ChannelDonut({ data }: { data: { channel: BackendChannel; count: number }[] }) {
  const total = data.reduce((sum, c) => sum + c.count, 0);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 h-full">
      <h3 className="font-semibold text-gray-900 mb-4">Conversaciones por Canal</h3>
      {total === 0 ? (
        <p className="text-sm text-gray-400 py-10 text-center">Todavía no hay conversaciones.</p>
      ) : (
        <div className="flex items-center gap-6">
          <div className="relative w-40 h-40 shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  dataKey="count"
                  nameKey="channel"
                  innerRadius="70%"
                  outerRadius="100%"
                  paddingAngle={2}
                  stroke="none"
                >
                  {data.map((c) => (
                    <Cell key={c.channel} fill={CHANNEL_COLORS[c.channel]} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-2xl font-bold text-gray-900">{total.toLocaleString('es-BO')}</span>
              <span className="text-xs text-gray-500">Total</span>
            </div>
          </div>

          <div className="flex-1 space-y-2.5 min-w-0">
            {data.map((c) => (
              <div key={c.channel} className="flex items-center gap-2 text-sm">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: CHANNEL_COLORS[c.channel] }} />
                <span className="flex-1 text-gray-700 truncate">{CHANNEL_LABELS[c.channel]}</span>
                <span className="font-semibold text-gray-900">{c.count.toLocaleString('es-BO')}</span>
                <span className="text-gray-400 text-xs w-12 text-right">{((c.count / total) * 100).toFixed(1)}%</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
