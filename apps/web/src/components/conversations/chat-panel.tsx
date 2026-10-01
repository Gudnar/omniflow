'use client';

import { useEffect, useState } from 'react';
import { Star, Info, MoreVertical, Send, Mic, Link2, Copy } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/lib/toast-context';
import { apiGet, apiPost } from '@/lib/api-client';
import { getStaffSocket, joinConversation, leaveConversation, type NewMessagePayload } from '@/lib/socket-client';
import type { Conversation, Message } from '@/lib/types';
import { CHANNEL_LABELS } from './mock-data';
import type { Channel } from './mock-data';
import { ChannelIcon } from './channel-icon';
import { Modal } from '@/components/ui/modal';

function initialsOf(name: string) {
  return name.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('');
}

export function ChatPanel({ conversation }: { conversation: Conversation | null }) {
  const { tokens } = useAuth();
  const toast = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageTab, setMessageTab] = useState<'message' | 'note'>('message');
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [webLink, setWebLink] = useState<string | null>(null);
  const [generatingLink, setGeneratingLink] = useState(false);

  useEffect(() => {
    if (!conversation) {
      setMessages([]);
      return;
    }
    apiGet<Message[]>(`/conversations/${conversation.id}/messages`, tokens?.accessToken)
      .then(setMessages)
      .catch((err) => console.error('Error fetching messages:', err));
  }, [conversation, tokens]);

  // Socket.IO here only means "a message landed in this conversation" — on
  // that signal we just re-run the same GET above, never trusting a message
  // shape pushed over the socket itself (see RealtimeGateway's docblock).
  useEffect(() => {
    if (!conversation || !tokens?.accessToken) return;

    const socket = getStaffSocket(tokens.accessToken);
    joinConversation(conversation.id);

    const handleNewMessage = (payload: NewMessagePayload) => {
      if (payload.conversationId !== conversation.id) return;
      apiGet<Message[]>(`/conversations/${conversation.id}/messages`, tokens.accessToken)
        .then(setMessages)
        .catch((err) => console.error('Error refetching messages:', err));
    };
    socket.on('message:new', handleNewMessage);

    return () => {
      socket.off('message:new', handleNewMessage);
      leaveConversation(conversation.id);
    };
  }, [conversation, tokens]);

  const generateWebLink = async () => {
    if (!conversation) return;
    setGeneratingLink(true);
    try {
      const result = await apiPost<{ url: string }>(
        `/conversations/${conversation.id}/generate-web-link`,
        tokens?.accessToken,
        {},
      );
      setWebLink(result.url);
    } catch (err: any) {
      toast.error(err.message ?? 'No se pudo generar el enlace');
    } finally {
      setGeneratingLink(false);
    }
  };

  const copyWebLink = () => {
    if (!webLink) return;
    navigator.clipboard.writeText(webLink).then(() => toast.success('Enlace copiado al portapapeles'));
  };

  const send = async () => {
    if (!conversation || !text.trim() || sending) return;
    setSending(true);
    try {
      const created = await apiPost<Message>(`/conversations/${conversation.id}/messages`, tokens?.accessToken, {
        direction: 'OUTBOUND',
        type: messageTab === 'note' ? 'NOTE' : 'TEXT',
        content: text,
      });
      setMessages((prev) => [...prev, created]);
      setText('');
    } catch (err: any) {
      // No success toast here — the message appearing in the thread already
      // confirms it; a toast per message sent would be noise. Only the
      // failure case (silent otherwise) needs surfacing.
      toast.error(err.message ?? 'No se pudo enviar el mensaje');
    } finally {
      setSending(false);
    }
  };

  if (!conversation) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-[#f7f8fa]">
        <p className="text-sm text-gray-400">Selecciona una conversación</p>
      </div>
    );
  }

  const channel = conversation.channel.toLowerCase() as Channel;

  return (
    <div className="w-full h-full flex flex-col bg-[#f7f8fa]">
      {/* Header */}
      <div className="h-[73px] shrink-0 bg-white border-b border-gray-200 flex items-center justify-between px-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-pink-500 flex items-center justify-center text-white text-sm font-semibold">
            {initialsOf(conversation.contact.name)}
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <p className="text-sm font-semibold text-gray-900">{conversation.contact.name}</p>
              <ChannelIcon channel={channel} className="w-3.5 h-3.5" />
              <span className="text-xs text-gray-400">{CHANNEL_LABELS[channel]}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={generateWebLink}
            disabled={generatingLink}
            title="Enviar enlace para continuar por web"
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 transition disabled:opacity-50"
          >
            <Link2 className="w-[18px] h-[18px]" />
          </button>
          <button className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 transition">
            <Star className="w-[18px] h-[18px]" />
          </button>
          <button className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 transition">
            <Info className="w-[18px] h-[18px]" />
          </button>
          <button className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 transition">
            <MoreVertical className="w-[18px] h-[18px]" />
          </button>
        </div>
      </div>

      <Modal open={webLink !== null} onClose={() => setWebLink(null)} title="Enlace para continuar por web">
        <p className="text-sm text-gray-500 mb-3">
          Compartíselo al cliente (por ejemplo, por este mismo WhatsApp) para que pueda seguir la conversación desde
          el navegador, con todo el historial.
        </p>
        <div className="flex items-center gap-2">
          <input readOnly value={webLink ?? ''} className="flex-1 min-w-0 px-3 py-2 border border-gray-300 rounded-lg text-sm bg-gray-50" />
          <button onClick={copyWebLink} className="p-2.5 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-600 shrink-0">
            <Copy className="w-4 h-4" />
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-3">
          Generar un enlace nuevo invalida el anterior — el cliente que ya tenía el viejo dejará de poder usarlo.
        </p>
      </Modal>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
        {messages.map((m) => {
          const isOutbound = m.direction === 'OUTBOUND';

          if (m.type === 'SYSTEM') {
            return (
              <div key={m.id} className="flex justify-center">
                <span className="text-[11px] font-medium text-amber-700 bg-amber-50 border border-amber-100 px-3 py-1 rounded-full">
                  {m.content} · {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            );
          }

          if (m.type === 'NOTE') {
            return (
              <div key={m.id} className="flex justify-end">
                <div className="max-w-md bg-amber-50 border border-amber-100 rounded-2xl rounded-tr-sm px-4 py-2.5 shadow-sm">
                  <p className="text-[10px] font-semibold text-amber-700 mb-1">Nota interna</p>
                  <p className="text-sm text-gray-800">{m.content}</p>
                  <p className="text-[10px] text-gray-400 text-right mt-1">
                    {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            );
          }

          if (m.type === 'CTA' && m.ctaPayload) {
            const intro = m.content.replace(m.ctaPayload.url, '').trim();
            const label = m.ctaPayload.action === 'BOOKING' ? 'Reservar cita' : 'Ir a la tienda';
            return (
              <div key={m.id} className="flex justify-end">
                <div className="max-w-md bg-blue-600 text-white rounded-2xl rounded-tr-sm px-4 py-2.5 shadow-sm">
                  <div className="flex items-center gap-1.5 mb-1 opacity-80">
                    <Link2 className="w-3 h-3" />
                    <span className="text-[10px] font-semibold uppercase tracking-wide">Enlace enviado por el agente</span>
                  </div>
                  {intro && <p className="text-sm">{intro}</p>}
                  <a href={m.ctaPayload.url} target="_blank" rel="noreferrer" className="block text-sm underline text-blue-100 mt-1">
                    {label}
                  </a>
                  <p className="text-[10px] text-right mt-1 text-blue-100">
                    {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            );
          }

          if (m.type === 'AUDIO') {
            return (
              <div key={m.id} className={`flex ${isOutbound ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-md rounded-2xl px-4 py-2.5 shadow-sm ${
                    isOutbound ? 'bg-blue-600 text-white rounded-tr-sm' : 'bg-white rounded-tl-sm'
                  }`}
                >
                  <div className="flex items-center gap-1.5 mb-1 opacity-70">
                    <Mic className="w-3 h-3" />
                    <span className="text-[10px] font-semibold uppercase tracking-wide">Nota de voz</span>
                  </div>
                  <p className={`text-sm ${isOutbound ? '' : 'text-gray-800'} ${!m.content ? 'italic opacity-70' : ''}`}>
                    {m.content || 'Transcribiendo…'}
                  </p>
                  {m.attachments.map((a) => (
                    // eslint-disable-next-line jsx-a11y/media-has-caption
                    <audio key={a.id} controls src={a.url} className="mt-2 max-w-full h-8" />
                  ))}
                  <p className={`text-[10px] text-right mt-1 ${isOutbound ? 'text-blue-100' : 'text-gray-400'}`}>
                    {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            );
          }

          return (
            <div key={m.id} className={`flex ${isOutbound ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-md rounded-2xl px-4 py-2.5 shadow-sm ${
                  isOutbound ? 'bg-blue-600 text-white rounded-tr-sm' : 'bg-white rounded-tl-sm'
                }`}
              >
                <p className={`text-sm ${isOutbound ? '' : 'text-gray-800'}`}>{m.content}</p>
                {m.attachments.map((a) => (
                  <a
                    key={a.id}
                    href={a.url}
                    target="_blank"
                    rel="noreferrer"
                    className={`block text-xs underline mt-1 ${isOutbound ? 'text-blue-100' : 'text-blue-600'}`}
                  >
                    {a.fileName}
                  </a>
                ))}
                <p className={`text-[10px] text-right mt-1 ${isOutbound ? 'text-blue-100' : 'text-gray-400'}`}>
                  {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          );
        })}

        {messages.length === 0 && <p className="text-sm text-gray-400 text-center mt-8">Sin mensajes todavía.</p>}
      </div>

      {/* Composer */}
      <div className="shrink-0 bg-white border-t border-gray-200 p-4">
        <div className="flex items-center gap-4 mb-3">
          <button
            onClick={() => setMessageTab('message')}
            className={`text-sm font-medium pb-1 border-b-2 transition ${
              messageTab === 'message' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500'
            }`}
          >
            Mensaje
          </button>
          <button
            onClick={() => setMessageTab('note')}
            className={`text-sm font-medium pb-1 border-b-2 transition ${
              messageTab === 'note' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500'
            }`}
          >
            Nota interna
          </button>
        </div>

        <div className="flex items-end gap-3">
          <div className="flex-1 border border-gray-300 rounded-xl px-4 py-3 focus-within:ring-2 focus-within:ring-blue-500">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && send()}
              placeholder={messageTab === 'note' ? 'Escribe una nota interna...' : 'Escribe un mensaje...'}
              className="w-full text-sm outline-none placeholder-gray-400"
            />
          </div>
          <button
            onClick={send}
            disabled={sending || !text.trim()}
            className="w-11 h-11 rounded-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center text-white shrink-0 transition"
          >
            <Send className="w-[18px] h-[18px]" />
          </button>
        </div>
      </div>
    </div>
  );
}
