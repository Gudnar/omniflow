'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { Send, Loader2, Link2, Check } from 'lucide-react';
import { apiGet, apiPost } from '@/lib/api-client';
import { connectAsVisitor } from '@/lib/socket-client';
import type { ConversationWindowData } from '@/lib/types';
import type { Socket } from 'socket.io-client';

// "Continue this conversation from the web" — reached via a link an operator
// generates from an EXISTING conversation (see the "Enviar enlace web"
// button in chat-panel.tsx), not a fresh chat. A message typed here reaches
// the business's dashboard/AI agent live (same Socket.IO + MessagesService
// pipeline as the Página de Enlaces widget), but — a real limitation, not a
// bug — it can never appear on the customer's own WhatsApp app: the
// Business API has no way to echo a message onto the customer's own phone
// as if they had sent it from there.
const GREEN = '#25D366';
const GREEN_DARK = '#128C7E';
// Same blue WhatsApp uses for its native "cta_url" interactive-message
// buttons — matched here so these read as an extension of that pattern
// rather than a generic app button.
const WHATSAPP_LINK_BLUE = '#0294FF';

// A subtle, hand-rolled doodle tile evoking WhatsApp's chat wallpaper
// without reproducing Meta's actual (trademarked) artwork — same visual
// language, not a copy of the asset.
const CHAT_WALLPAPER = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120' viewBox='0 0 120 120'%3E%3Cg fill='none' stroke='%23d3c8b8' stroke-width='1.2' opacity='0.55'%3E%3Ccircle cx='20' cy='24' r='3' fill='%23d3c8b8' stroke='none'/%3E%3Cpath d='M50 20 q6 -12 12 0 q6 12 12 0'/%3E%3Ccircle cx='95' cy='30' r='2' fill='%23d3c8b8' stroke='none'/%3E%3Cpath d='M15 65 q5 -9 10 0'/%3E%3Ccircle cx='60' cy='70' r='2.5' fill='%23d3c8b8' stroke='none'/%3E%3Cpath d='M85 85 q6 -11 12 0 q6 11 12 0'/%3E%3Ccircle cx='30' cy='100' r='2' fill='%23d3c8b8' stroke='none'/%3E%3Cpath d='M100 105 q5 -9 10 0'/%3E%3C/g%3E%3C/svg%3E")`;

function formatDateSeparator(iso: string): string {
  const date = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (sameDay(date, today)) return 'Hoy';
  if (sameDay(date, yesterday)) return 'Ayer';
  return date.toLocaleDateString('es-BO', { day: 'numeric', month: 'long', year: 'numeric' });
}

export default function ConversationWindowPage() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<ConversationWindowData | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const loadWindow = () =>
    apiGet<ConversationWindowData>(`/conversation-window/${token}`)
      .then(setData)
      .catch(() => setNotFound(true));

  useEffect(() => {
    if (!token) return;
    loadWindow();

    const socket = connectAsVisitor(token);
    socketRef.current = socket;
    socket.on('message:new', loadWindow);

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [data?.messages.length]);

  const send = async () => {
    if (!text.trim() || sending) return;
    setSending(true);
    const content = text;
    setText('');
    try {
      await apiPost(`/conversation-window/${token}/messages`, undefined, { content });
      await loadWindow();
    } catch (err) {
      console.error('Error sending message:', err);
    } finally {
      setSending(false);
    }
  };

  if (notFound) {
    return (
      <div className="h-dvh flex items-center justify-center bg-gray-50 px-6">
        <p className="text-sm text-gray-400 text-center">Este enlace no es válido o ya expiró.</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="h-dvh flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    // h-dvh (dynamic viewport height), not min-h-screen (100vh) — 100vh on
    // mobile locks in the height from BEFORE the on-screen keyboard opens,
    // so the input bar at the bottom of this flex column ends up pushed
    // below the visible area once the keyboard appears. dvh shrinks with
    // the visual viewport the same way WhatsApp's own web/app UI does, so
    // the input stays pinned right above the keyboard instead of hidden
    // behind it.
    <div className="h-dvh flex flex-col overflow-hidden" style={{ backgroundColor: '#e5ded8' }}>
      <div className="shrink-0 flex items-center gap-3 px-4 py-2.5 text-white shadow-sm z-10" style={{ backgroundColor: GREEN_DARK }}>
        <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center overflow-hidden shrink-0">
          {data.businessLogo ? (
            <img src={data.businessLogo} alt="" className="w-full h-full object-cover" />
          ) : (
            <span className="text-sm font-bold">{data.businessName.slice(0, 1).toUpperCase()}</span>
          )}
        </div>
        <div className="min-w-0">
          <p className="text-[15px] font-medium truncate leading-tight">{data.businessName}</p>
          <p className="text-[12px] opacity-75 leading-tight">Cuenta de empresa</p>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-3 sm:px-6 py-3"
        style={{ backgroundColor: '#e5ded8', backgroundImage: CHAT_WALLPAPER, backgroundRepeat: 'repeat' }}
      >
        {data.messages.map((m, i) => {
          const isMine = m.direction === 'INBOUND';
          const prev = data.messages[i - 1];
          const next = data.messages[i + 1];
          const showDateSeparator = !prev || new Date(prev.createdAt).toDateString() !== new Date(m.createdAt).toDateString();
          // The tail-like sharp corner (matching current WhatsApp's bubble
          // shape) only belongs on the LAST bubble of a consecutive run from
          // the same sender — grouped bubbles above it stay fully rounded,
          // exactly like the real app.
          const isLastInGroup = !next || next.direction !== m.direction || next.type === 'CTA';
          const bubbleRadius = isMine
            ? { borderRadius: isLastInGroup ? '10px 10px 2px 10px' : '10px' }
            : { borderRadius: isLastInGroup ? '10px 10px 10px 2px' : '10px' };

          const dateSeparator = showDateSeparator && (
            <div key={`${m.id}-date`} className="flex justify-center py-2">
              <span className="text-[11px] font-medium text-gray-600 bg-white/90 px-3 py-1 rounded-lg shadow-sm">
                {formatDateSeparator(m.createdAt)}
              </span>
            </div>
          );

          const time = new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

          if (m.type === 'CTA' && m.ctaPayload) {
            const intro = m.content.replace(m.ctaPayload.url, '').trim();
            const label = m.ctaPayload.action === 'BOOKING' ? 'Reservar cita' : 'Ir a la tienda';
            return (
              <div key={m.id}>
                {dateSeparator}
                <div className={`flex justify-start ${isLastInGroup ? 'mb-2' : 'mb-0.5'}`}>
                  <div className="max-w-[75%] w-full rounded-lg shadow-sm overflow-hidden bg-white">
                    {intro && <p className="px-3 pt-2.5 pb-2 text-sm text-gray-800">{intro}</p>}
                    <a
                      href={m.ctaPayload.url}
                      className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-medium border-t border-gray-200"
                      style={{ color: WHATSAPP_LINK_BLUE }}
                    >
                      <Link2 className="w-4 h-4" />
                      {label}
                    </a>
                  </div>
                </div>
              </div>
            );
          }

          return (
            <div key={m.id}>
              {dateSeparator}
              <div className={`flex ${isMine ? 'justify-end' : 'justify-start'} ${isLastInGroup ? 'mb-2' : 'mb-0.5'}`}>
                <div
                  className="relative max-w-[75%] px-2.5 pt-1.5 pb-1.5 text-sm shadow-sm"
                  style={{ backgroundColor: isMine ? '#dcf8c6' : '#ffffff', ...bubbleRadius }}
                >
                  <p className="text-gray-800 whitespace-pre-wrap pr-1" style={{ wordBreak: 'break-word' }}>
                    {m.content}
                  </p>
                  <div className="flex items-center justify-end gap-0.5 -mb-0.5 mt-0.5">
                    <span className="text-[10px] text-gray-400">{time}</span>
                    {isMine && <Check className="w-3.5 h-3.5 text-gray-400" strokeWidth={2.5} />}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        {data.messages.length === 0 && (
          <p className="text-center text-sm text-gray-500 mt-8">Escribí tu mensaje para continuar la conversación.</p>
        )}
      </div>

      <div
        className="shrink-0 bg-[#f0f0f0] p-3 flex items-center gap-2"
        style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
          placeholder="Escribe un mensaje"
          className="flex-1 min-w-0 px-4 py-2.5 rounded-full border-none text-sm bg-white"
        />
        <button
          onClick={send}
          disabled={sending || !text.trim()}
          className="w-10 h-10 rounded-full text-white flex items-center justify-center disabled:opacity-50 shrink-0"
          style={{ backgroundColor: GREEN }}
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
