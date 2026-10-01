'use client';

import { ArrowRight } from 'lucide-react';

const leads = [
  { name: 'Juan Sánchez', channel: 'WhatsApp', time: 'Hace 5 min', score: 80, initials: 'JS', color: '#a855f7' },
  { name: 'Lucía Mendoza', channel: 'Instagram', time: 'Hace 15 min', score: 60, initials: 'LM', color: '#3b82f6' },
  { name: 'Carlos Ruiz', channel: 'Facebook', time: 'Hace 30 min', score: 75, initials: 'CR', color: '#f59e0b' },
  { name: 'Andrea Vega', channel: 'TikTok', time: 'Hace 45 min', score: 40, initials: 'AV', color: '#ef4444' },
  { name: 'Miguel Torres', channel: 'WhatsApp', time: 'Hace 1 hora', score: 70, initials: 'MG', color: '#22c55e' },
];

function scoreColor(score: number) {
  if (score >= 70) return 'text-emerald-600';
  if (score >= 50) return 'text-amber-600';
  return 'text-red-500';
}

export function RecentLeads() {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 h-full flex flex-col">
      <h3 className="font-semibold text-gray-900 mb-4">Leads Recientes</h3>

      <div className="space-y-4 flex-1">
        {leads.map((l) => (
          <div key={l.name} className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-semibold shrink-0"
              style={{ backgroundColor: l.color }}
            >
              {l.initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-gray-900 truncate">{l.name}</p>
              <p className="text-xs text-gray-500 truncate">{l.channel}</p>
            </div>
            <span className="text-xs text-gray-400 shrink-0">{l.time}</span>
            <span className={`text-sm font-bold shrink-0 w-8 text-right ${scoreColor(l.score)}`}>
              {l.score}
            </span>
          </div>
        ))}
      </div>

      <button className="mt-4 text-sm text-blue-600 font-medium hover:text-blue-700 flex items-center gap-1">
        Ver todos los leads <ArrowRight className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
