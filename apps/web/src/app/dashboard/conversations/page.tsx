'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { apiGet } from '@/lib/api-client';
import { getStaffSocket, type NewMessagePayload } from '@/lib/socket-client';
import type { Conversation } from '@/lib/types';
import { ConversationList } from '@/components/conversations/conversation-list';
import { ChatPanel } from '@/components/conversations/chat-panel';
import { ContactPanel } from '@/components/conversations/contact-panel';

export default function ConversationsPage() {
  const router = useRouter();
  const { user, tokens, isLoading } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && !user) router.push('/login');
  }, [isLoading, user, router]);

  const refetchConversations = () => {
    if (!tokens) return Promise.resolve();
    return apiGet<Conversation[]>('/conversations', tokens.accessToken)
      .then((data) => {
        setConversations(data);
        setSelectedId((current) => current ?? data[0]?.id ?? null);
      })
      .catch((err) => console.error('Error fetching conversations:', err));
  };

  useEffect(() => {
    if (!user || !tokens) return;
    refetchConversations().finally(() => setDataLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, tokens]);

  // A staff member auto-joins their tenant's room on connect (see
  // RealtimeGateway.handleConnection) — ANY new message in ANY conversation
  // of this tenant lands here, which is exactly the scope the list needs
  // (unlike chat-panel.tsx, which only cares about the one open thread).
  useEffect(() => {
    if (!tokens?.accessToken) return;
    const socket = getStaffSocket(tokens.accessToken);
    const handleNewMessage = (_payload: NewMessagePayload) => refetchConversations();
    socket.on('message:new', handleNewMessage);
    return () => {
      socket.off('message:new', handleNewMessage);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tokens]);

  const selected = conversations.find((c) => c.id === selectedId) ?? null;

  if (isLoading || dataLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full" />
      </div>
    );
  }

  return (
    <div className="h-full flex overflow-hidden">
      <div className="w-[380px] shrink-0 h-full">
        <ConversationList conversations={conversations} selectedId={selectedId} onSelect={setSelectedId} />
      </div>
      <div className="flex-1 min-w-0 h-full">
        <ChatPanel conversation={selected} />
      </div>
      <div className="w-[340px] shrink-0 h-full hidden xl:block">
        <ContactPanel conversation={selected} />
      </div>
    </div>
  );
}
