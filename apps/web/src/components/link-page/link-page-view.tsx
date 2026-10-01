'use client';

// Shared render for both the admin live preview (link-page-editor.tsx) and
// the actual public page (/enlaces/[slug]) — one place to keep them
// pixel-identical instead of maintaining two copies of the same markup.

const ICON_EMOJI: Record<string, string> = {
  whatsapp: '💬',
  instagram: '📸',
  facebook: '👍',
  tiktok: '🎵',
  link: '🔗',
  store: '🛍️',
  calendar: '📅',
  download: '⬇️',
};

export interface LinkPageViewData {
  title: string;
  bio: string | null;
  avatarUrl: string | null;
  primaryColor: string;
  backgroundColor: string;
  textColor: string;
  items: { id: string; label: string; url: string; icon: string | null }[];
}

export function LinkPageView({
  page,
  interactive = true,
  onItemClick,
  className = '',
}: {
  page: LinkPageViewData;
  // false in the admin preview pane — renders identically but clicks don't
  // navigate away or fire the click-tracking beacon.
  interactive?: boolean;
  onItemClick?: (itemId: string) => void;
  // Lets each usage site control the height context (min-h-screen on the
  // public page, h-full inside the editor's fixed-size phone frame).
  className?: string;
}) {
  return (
    <div
      className={`flex justify-center px-6 py-10 ${className}`}
      style={{ backgroundColor: page.backgroundColor, color: page.textColor }}
    >
      {/* Capped at a phone-like width and centered — on a wide desktop
          browser this still reads as a mobile bio-link page (matching real
          Linktree's behavior), not a stretched desktop layout. */}
      <div className="w-full max-w-[420px] flex flex-col items-center gap-5">
        <div className="w-20 h-20 rounded-full overflow-hidden bg-black/5 flex items-center justify-center shrink-0">
          {page.avatarUrl ? (
            <img src={page.avatarUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <span className="text-2xl font-bold opacity-40">{page.title.slice(0, 1).toUpperCase()}</span>
          )}
        </div>

        <div className="text-center">
          <p className="text-lg font-bold">{page.title}</p>
          {page.bio && <p className="text-sm opacity-70 mt-1 whitespace-pre-line">{page.bio}</p>}
        </div>

        <div className="w-full flex flex-col gap-3 mt-2">
          {page.items.map((item) => {
            // A download link navigates the browser straight to
            // LinkPageService.resolveDownload's endpoint (see the parent
            // page's URL rewrite) — same tab, since there's no real
            // destination page to view, just a save-file prompt.
            const isDownload = item.icon === 'download';
            return (
              <a
                key={item.id}
                href={item.url}
                target={interactive && !isDownload ? '_blank' : undefined}
                rel={interactive && !isDownload ? 'noreferrer' : undefined}
                onClick={(e) => {
                  if (!interactive) {
                    e.preventDefault();
                    return;
                  }
                  onItemClick?.(item.id);
                }}
                className="w-full flex items-center justify-center gap-2 px-4 py-3.5 rounded-full font-semibold text-sm text-center transition hover:opacity-90 active:scale-[0.98]"
                style={{ backgroundColor: page.primaryColor, color: '#ffffff' }}
              >
                {item.icon && ICON_EMOJI[item.icon] && <span>{ICON_EMOJI[item.icon]}</span>}
                {item.label}
              </a>
            );
          })}
          {page.items.length === 0 && (
            <p className="text-center text-sm opacity-50">Todavía no hay enlaces.</p>
          )}
        </div>
      </div>
    </div>
  );
}
