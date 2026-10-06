'use client';

import { ArrowRight } from 'lucide-react';
import { useRouter } from 'next/navigation';

const AVATAR_COLORS = ['#a855f7', '#3b82f6', '#f59e0b', '#ef4444', '#22c55e'];

function initialsOf(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');
}

// e.g. "Hace 5 min" / "Hace 3 h" / "Hace 2 d" — a lead's exact timestamp
// matters less than how fresh it is, same rationale as elsewhere in the
// dashboard's relative-time displays.
function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'Recién';
  if (minutes < 60) return `Hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Hace ${hours} h`;
  const days = Math.floor(hours / 24);
  return `Hace ${days} d`;
}

interface RecentLead {
  id: string;
  name: string;
  phone: string | null;
  createdAt: string;
}

export function RecentLeads({ leads }: { leads: RecentLead[] }) {
  const router = useRouter();

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 h-full flex flex-col">
      <h3 className="font-semibold text-gray-900 mb-4">Leads Recientes</h3>

      {leads.length === 0 ? (
        <p className="text-sm text-gray-400 py-10 text-center flex-1">Sin leads todavía.</p>
      ) : (
        <div className="space-y-4 flex-1">
          {leads.map((l, i) => (
            <div key={l.id} className="flex items-center gap-3">
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-semibold shrink-0"
                style={{ backgroundColor: AVATAR_COLORS[i % AVATAR_COLORS.length] }}
              >
                {initialsOf(l.name)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-900 truncate">{l.name}</p>
                <p className="text-xs text-gray-500 truncate">{l.phone ?? 'Sin teléfono'}</p>
              </div>
              <span className="text-xs text-gray-400 shrink-0">{relativeTime(l.createdAt)}</span>
            </div>
          ))}
        </div>
      )}

      <button
        onClick={() => router.push('/dashboard/contacts')}
        className="mt-4 text-sm text-blue-600 font-medium hover:text-blue-700 flex items-center gap-1"
      >
        Ver todos los leads <ArrowRight className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
