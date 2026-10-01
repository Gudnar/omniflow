'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { CampaignsTab } from '@/components/campaigns/campaigns-tab';
import { SegmentsTab } from '@/components/campaigns/segments-tab';

const TABS = ['Campañas', 'Segmentos'] as const;
type Tab = (typeof TABS)[number];

export default function CampaignsPage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const [tab, setTab] = useState<Tab>('Campañas');

  useEffect(() => {
    if (!isLoading && !user) router.push('/login');
  }, [isLoading, user, router]);

  if (isLoading || !user) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full" />
      </div>
    );
  }

  return (
    <div className="max-w-[1800px] mx-auto px-4 sm:px-6 py-6 space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Campañas</h1>
        <p className="text-sm text-gray-500 mt-0.5">Envíos masivos de plantillas aprobadas a segmentos de contactos.</p>
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

      {tab === 'Campañas' && <CampaignsTab />}
      {tab === 'Segmentos' && <SegmentsTab />}
    </div>
  );
}
