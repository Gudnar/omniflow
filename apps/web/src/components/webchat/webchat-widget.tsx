'use client';

import { useEffect, useRef, useState } from 'react';
import { MessageCircle, X, Send, Link2 } from 'lucide-react';
import { apiGet, apiPost } from '@/lib/api-client';
import { connectAsVisitor } from '@/lib/socket-client';
import type { WebchatMessage } from '@/lib/types';
import type { Socket } from 'socket.io-client';
import { ImageLightbox } from '@/components/ui/image-lightbox';

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
  // Quick-reply buttons and forms are one-shot — once the visitor answers
  // one, that same bubble shows as answered instead of staying clickable.
  const [answeredIds, setAnsweredIds] = useState<Set<string>>(new Set());
  const [lightboxImage, setLightboxImage] = useState<{ url: string; alt: string } | null>(null);
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

  const sendContent = async (content: string, sourceMessageId?: string) => {
    if (!content.trim() || sending) return;
    setSending(true);
    try {
      const s = session ?? (await ensureSession());
      await apiPost(`/webchat/conversations/${s.conversationId}/messages`, undefined, {
        webchatToken: s.webchatToken,
        content,
      });
      if (sourceMessageId) setAnsweredIds((prev) => new Set(prev).add(sourceMessageId));
      loadMessages(s);
    } catch (err) {
      console.error('Error sending webchat message:', err);
    } finally {
      setSending(false);
    }
  };

  const send = async () => {
    if (!text.trim()) return;
    const content = text;
    setText('');
    await sendContent(content);
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
    <>
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
          const answered = answeredIds.has(m.id);

          if (m.type === 'CTA' && m.ctaPayload) {
            return (
              <div key={m.id} className="flex justify-start">
                <div className="max-w-[85%] w-full rounded-2xl shadow-sm overflow-hidden bg-white border border-gray-100">
                  {m.content.replace(m.ctaPayload.url, '').trim() && (
                    <p className="px-3 pt-2.5 pb-2 text-sm text-gray-800">{m.content.replace(m.ctaPayload.url, '').trim()}</p>
                  )}
                  <a
                    href={m.ctaPayload.url}
                    target="_blank"
                    rel="noreferrer"
                    className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-semibold border-t border-gray-100"
                    style={{ color: primaryColor }}
                  >
                    <Link2 className="w-3.5 h-3.5" />
                    {m.ctaPayload.label}
                  </a>
                </div>
              </div>
            );
          }

          if (m.type === 'INTERACTIVE' && m.interactivePayload?.kind === 'quick_replies') {
            const payload = m.interactivePayload;
            return (
              <div key={m.id} className="flex justify-start">
                <div className="max-w-[85%] w-full rounded-2xl shadow-sm overflow-hidden bg-white border border-gray-100">
                  <p className="px-3 pt-2.5 pb-2 text-sm text-gray-800">{payload.message}</p>
                  <div className="flex flex-wrap gap-1.5 px-3 pb-3">
                    {payload.options.map((opt) => (
                      <button
                        key={opt.id}
                        disabled={answered || sending}
                        onClick={() => sendContent(opt.label, m.id)}
                        className="px-3 py-1.5 rounded-full border text-xs font-semibold disabled:opacity-50 transition"
                        style={{ borderColor: primaryColor, color: primaryColor }}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            );
          }

          if (m.type === 'INTERACTIVE' && m.interactivePayload?.kind === 'form') {
            return (
              <InteractiveFormBubble
                key={m.id}
                payload={m.interactivePayload}
                answered={answered}
                sending={sending}
                primaryColor={primaryColor}
                onSubmit={(summary) => sendContent(summary, m.id)}
              />
            );
          }

          const imageAttachment = m.attachments?.find((a) => a.mimeType.startsWith('image/'));
          return (
            <div key={m.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${isMine ? 'text-white' : 'bg-gray-100 text-gray-800'}`}
                style={isMine ? { backgroundColor: primaryColor } : undefined}
              >
                {imageAttachment && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={imageAttachment.url}
                    alt={m.content || imageAttachment.fileName}
                    className="max-w-full rounded-lg mb-1 cursor-pointer"
                    onClick={() => setLightboxImage({ url: imageAttachment.url, alt: m.content || imageAttachment.fileName })}
                  />
                )}
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
    {lightboxImage && (
      <ImageLightbox src={lightboxImage.url} alt={lightboxImage.alt} onClose={() => setLightboxImage(null)} />
    )}
    </>
  );
}

// Submitting builds one human-readable text summary ("Nombre: Juan\nEmail:
// ...") sent as a normal INBOUND message — the backend has no separate
// "form submission" concept, this is the intentional degrade-to-text path
// (see onSubmit callers), so the submission reads naturally in the thread
// and feeds the AI agent's context without new parsing logic downstream.
function InteractiveFormBubble({
  payload,
  answered,
  sending,
  primaryColor,
  onSubmit,
}: {
  payload: Extract<NonNullable<WebchatMessage['interactivePayload']>, { kind: 'form' }>;
  answered: boolean;
  sending: boolean;
  primaryColor: string;
  onSubmit: (summary: string) => void;
}) {
  const [values, setValues] = useState<Record<string, string>>({});

  const canSubmit = payload.fields.every((f) => (values[f.id] ?? '').trim().length > 0);

  const submit = () => {
    if (!canSubmit) return;
    const summary = payload.fields.map((f) => `${f.label}: ${(values[f.id] ?? '').trim()}`).join('\n');
    onSubmit(summary);
  };

  return (
    <div className="flex justify-start">
      <div className="max-w-[90%] w-full rounded-2xl shadow-sm overflow-hidden bg-white border border-gray-100">
        <p className="px-3 pt-2.5 pb-2 text-sm text-gray-800">{payload.message}</p>
        <div className="px-3 pb-3 space-y-2">
          {payload.fields.map((f) => (
            <input
              key={f.id}
              type={f.fieldType === 'number' ? 'number' : f.fieldType === 'email' ? 'email' : f.fieldType === 'tel' ? 'tel' : 'text'}
              placeholder={f.label}
              disabled={answered}
              value={values[f.id] ?? ''}
              onChange={(e) => setValues((prev) => ({ ...prev, [f.id]: e.target.value }))}
              className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs disabled:opacity-50"
            />
          ))}
          <button
            onClick={submit}
            disabled={answered || sending || !canSubmit}
            className="w-full py-2 rounded-lg text-white text-xs font-semibold disabled:opacity-50"
            style={{ backgroundColor: primaryColor }}
          >
            {payload.submitLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
