'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { apiGet, apiPost } from '@/lib/api-client';
import type { PublicLinkPage } from '@/lib/types';
import { LinkPageView } from '@/components/link-page/link-page-view';
import { WebchatWidget } from '@/components/webchat/webchat-widget';

export default function PublicLinkPagePage() {
  const { slug } = useParams<{ slug: string }>();
  const [page, setPage] = useState<PublicLinkPage | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    apiGet<PublicLinkPage>(`/link-page/public/${slug}`)
      .then(setPage)
      .catch(() => setNotFound(true));
  }, [slug]);

  const handleItemClick = (itemId: string) => {
    // Download items already get their click counted server-side as part of
    // serving the file (see resolveDownload) — posting here too would
    // double-count every download.
    const item = page?.items.find((i) => i.id === itemId);
    if (item?.icon === 'download') return;
    // Fire-and-forget: never blocks the link's own navigation.
    apiPost(`/link-page/public/${slug}/items/${itemId}/click`, undefined, {}).catch(() => {});
  };

  if (notFound) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-6">
        <p className="text-sm text-gray-400 text-center">Esta página no existe o todavía no está publicada.</p>
      </div>
    );
  }

  if (!page) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin w-8 h-8 border-4 border-gray-200 border-t-gray-500 rounded-full" />
      </div>
    );
  }

  // Download items point at their own force-download endpoint (sets
  // Content-Disposition: attachment) instead of the raw uploaded-file URL,
  // which most browsers would otherwise just open inline (a PDF viewer tab)
  // rather than actually downloading.
  const pageForDisplay = {
    ...page,
    items: page.items.map((item) =>
      item.icon === 'download' ? { ...item, url: `/api/link-page/public/${slug}/items/${item.id}/download` } : item,
    ),
  };

  return (
    <>
      <LinkPageView page={pageForDisplay} interactive onItemClick={handleItemClick} className="min-h-screen" />
      {page.chatEnabled && (
        <WebchatWidget
          startUrl={`/webchat/${slug}/start`}
          storageKey={`webchat_${slug}`}
          primaryColor={page.primaryColor}
        />
      )}
    </>
  );
}
