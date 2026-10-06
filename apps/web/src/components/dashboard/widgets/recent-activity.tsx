'use client';

import { MessageCircle, Phone, Mail, Users, StickyNote, ArrowRight } from 'lucide-react';
import { useRouter } from 'next/navigation';

const TYPE_ICON: Record<string, React.ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
  CALL: Phone,
  EMAIL: Mail,
  MEETING: Users,
  WHATSAPP: MessageCircle,
  TASK: StickyNote,
  OTHER: StickyNote,
};

const TYPE_COLORS: Record<string, { bg: string; color: string }> = {
  CALL: { bg: '#dbeafe', color: '#2563eb' },
  EMAIL: { bg: '#fef3c7', color: '#d97706' },
  MEETING: { bg: '#fce7f3', color: '#db2777' },
  WHATSAPP: { bg: '#dcfce7', color: '#16a34a' },
  TASK: { bg: '#ede9fe', color: '#7c3aed' },
  OTHER: { bg: '#f3f4f6', color: '#4b5563' },
};

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

interface RecentActivityEntry {
  id: string;
  type: string;
  subject: string;
  description: string | null;
  contactName: string;
  occurredAt: string;
}

export function RecentActivity({ activities }: { activities: RecentActivityEntry[] }) {
  const router = useRouter();

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 h-full flex flex-col">
      <h3 className="font-semibold text-gray-900 mb-4">Actividad Reciente</h3>

      {activities.length === 0 ? (
        <p className="text-sm text-gray-400 py-10 text-center flex-1">Sin actividad todavía.</p>
      ) : (
        <div className="space-y-4 flex-1">
          {activities.map((a) => {
            const Icon = TYPE_ICON[a.type] ?? StickyNote;
            const { bg, color } = TYPE_COLORS[a.type] ?? TYPE_COLORS.OTHER;
            return (
              <div key={a.id} className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: bg }}>
                  <Icon className="w-4 h-4" style={{ color }} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 leading-tight truncate">{a.subject}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {a.contactName} · {relativeTime(a.occurredAt)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <button
        onClick={() => router.push('/dashboard/contacts')}
        className="mt-4 text-sm text-blue-600 font-medium hover:text-blue-700 flex items-center gap-1"
      >
        Ver toda la actividad <ArrowRight className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
