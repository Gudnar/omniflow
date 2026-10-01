'use client';

import { useEffect, useRef, useState } from 'react';
import { MessageCircle, X, Send } from 'lucide-react';
import { apiGet, apiPost } from '@/lib/api-client';
import { connectAsVisitor } from '@/lib/socket-client';
import type { WebchatMessage } from '@/lib/types';
import type { Socket } from 'socket.io-client';

interface WebchatSession {
  conversationId: string;
  webchatToken: string;
}

// Floating bubble + panel, reused on both the Página de Enlaces and the
// public storefront — the only difference between the two is which "start"
// endpoint mints the session (see startUrl) and the localStorage key that
// keeps it (storageKey), so each surface remembers its own conversation
// independently even for the same visitor/browser.
//
// Fully anonymous: the first open() mints a throwaway Contact+Conversation
// (see WebchatService.start()/startFromStore()), persisted in localStorage
// so reloading the page — or coming back another day from the same browser —
// continues the SAME conversation instead of starting a new one each time.
export function WebchatWidget({
  startUrl,
  storageKey,
  primaryColor = '#2563eb',
  title = 'Chatea con nosotros',
  placeholder = 'Escríbenos, ¡estamos para ayudarte!',
}: {
  startUrl: string;
  storageKey: string;
  primaryColor?: string;
  title?: string;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [session, setSession] = useState<WebchatSession | null>(null);
  const [messages, setMessages] = useState<WebchatMessage[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  const loadMessages = (s: WebchatSession) => {
    apiGet<WebchatMessage[]>(`/webchat/conversations/${s.conversationId}/messages?webchatToken=${s.webchatToken}`)
      .then(setMessages)
      .catch((err) => console.error('Error loading webchat messages:', err));
  };

  const ensureSession = async (): Promise<WebchatSession> => {
    const stored = typeof window !== 'undefined' ? localStorage.getItem(storageKey) : null;
    if (stored) {
      const parsed: WebchatSession = JSON.parse(stored);
      setSession(parsed);
      return parsed;
    }
    const created = await apiPost<WebchatSession>(startUrl, undefined, {});
    localStorage.setItem(storageKey, JSON.stringify(created));
    setSession(created);
    return created;
  };

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    ensureSession().then((s) => {
      if (cancelled) return;
      loadMessages(s);
      const socket = connectAsVisitor(s.webchatToken);
      socketRef.current = socket;
      socket.on('message:new', () => loadMessages(s));
    });

    return () => {
      cancelled = true;
      socketRef.current?.disconnect();
      socketRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const send = async () => {
    if (!text.trim() || sending) return;
    setSending(true);
    const content = text;
    setText('');
    try {
      const s = session ?? (await ensureSession());
      await apiPost(`/webchat/conversations/${s.conversationId}/messages`, undefined, {
        webchatToken: s.webchatToken,
        content,
      });
      loadMessages(s);
    } catch (err) {
      console.error('Error sending webchat message:', err);
    } finally {
      setSending(false);
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 w-14 h-14 rounded-full text-white shadow-xl flex items-center justify-center z-50 hover:opacity-90 transition"
        style={{ backgroundColor: primaryColor }}
        aria-label="Abrir chat"
      >
        <MessageCircle className="w-6 h-6" />
      </button>
    );
  }

  return (
    <div className="fixed bottom-5 right-5 w-80 max-w-[calc(100vw-2.5rem)] h-[28rem] bg-white rounded-2xl shadow-2xl flex flex-col z-50 border border-gray-200 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 text-white shrink-0" style={{ backgroundColor: primaryColor }}>
        <p className="text-sm font-semibold">{title}</p>
        <button onClick={() => setOpen(false)} aria-label="Cerrar chat">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {messages.map((m) => {
          const isMine = m.direction === 'INBOUND';
          return (
            <div key={m.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${isMine ? 'text-white' : 'bg-gray-100 text-gray-800'}`}
                style={isMine ? { backgroundColor: primaryColor } : undefined}
              >
                {m.content}
              </div>
            </div>
          );
        })}
        {messages.length === 0 && <p className="text-xs text-gray-400 text-center mt-6">{placeholder}</p>}
      </div>

      <div className="p-3 border-t border-gray-100 flex items-center gap-2 shrink-0">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
          placeholder="Escribe un mensaje..."
          className="flex-1 min-w-0 px-3 py-2 border border-gray-200 rounded-full text-sm"
        />
        <button
          onClick={send}
          disabled={sending || !text.trim()}
          className="w-9 h-9 rounded-full text-white flex items-center justify-center disabled:opacity-50 shrink-0"
          style={{ backgroundColor: primaryColor }}
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
