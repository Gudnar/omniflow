'use client';

import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';

const channels = [
  { name: 'WhatsApp', value: 2154, pct: '56.1%', color: '#22c55e' },
  { name: 'Instagram', value: 842, pct: '21.9%', color: '#a855f7' },
  { name: 'Facebook', value: 512, pct: '13.3%', color: '#3b82f6' },
  { name: 'TikTok', value: 214, pct: '5.6%', color: '#111827' },
  { name: 'Otros', value: 120, pct: '3.1%', color: '#9ca3af' },
];

const total = channels.reduce((sum, c) => sum + c.value, 0);

export function ChannelDonut() {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 h-full">
      <h3 className="font-semibold text-gray-900 mb-4">Conversaciones por Canal</h3>
      <div className="flex items-center gap-6">
        <div className="relative w-40 h-40 shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={channels}
                dataKey="value"
                nameKey="name"
                innerRadius="70%"
                outerRadius="100%"
                paddingAngle={2}
                stroke="none"
              >
                {channels.map((c) => (
                  <Cell key={c.name} fill={c.color} />
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
          {channels.map((c) => (
            <div key={c.name} className="flex items-center gap-2 text-sm">
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: c.color }}
              />
              <span className="flex-1 text-gray-700 truncate">{c.name}</span>
              <span className="font-semibold text-gray-900">{c.value.toLocaleString('es-BO')}</span>
              <span className="text-gray-400 text-xs w-12 text-right">{c.pct}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
