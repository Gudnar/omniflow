'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, CheckCheck } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { apiGet, apiPost } from '@/lib/api-client';
import { getStaffSocket } from '@/lib/socket-client';
import type { Notification } from '@/lib/types';

const POLL_INTERVAL_MS = 30000;

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'ahora';
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.floor(hours / 24);
  return `hace ${days} d`;
}

export function NotificationsBell() {
  const { tokens } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const openRef = useRef(open);
  openRef.current = open;

  const refreshUnreadCount = () => {
    if (!tokens) return;
    apiGet<{ count: number }>('/notifications/unread-count', tokens.accessToken)
      .then((r) => setUnreadCount(r.count))
      .catch((err) => console.error('Error fetching unread notification count:', err));
  };

  useEffect(() => {
    refreshUnreadCount();
    const interval = setInterval(refreshUnreadCount, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [tokens]);

  // Live push for new notifications (e.g. a storefront order/booking just
  // confirmed) — see RealtimeGateway's `notification.created` handler. The
  // 30s poll above stays as a fallback for a dropped/reconnecting socket.
  useEffect(() => {
    if (!tokens) return;
    const socket = getStaffSocket(tokens.accessToken);
    const onNotification = () => {
      refreshUnreadCount();
      if (openRef.current) {
        apiGet<Notification[]>('/notifications', tokens.accessToken)
          .then(setItems)
          .catch((err) => console.error('Error refreshing notifications:', err));
      }
    };
    socket.on('notification:new', onNotification);
    return () => {
      socket.off('notification:new', onNotification);
    };
  }, [tokens]);

  useEffect(() => {
    if (!open || !tokens) return;
    setLoading(true);
    apiGet<Notification[]>('/notifications', tokens.accessToken)
      .then(setItems)
      .catch((err) => console.error('Error fetching notifications:', err))
      .finally(() => setLoading(false));
  }, [open, tokens]);

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const openNotification = async (notification: Notification) => {
    if (!notification.readAt) {
      setItems((prev) => prev.map((n) => (n.id === notification.id ? { ...n, readAt: new Date().toISOString() } : n)));
      setUnreadCount((c) => Math.max(0, c - 1));
      try {
        await apiPost(`/notifications/${notification.id}/read`, tokens?.accessToken, {});
      } catch (err) {
        console.error('Error marking notification as read:', err);
      }
    }
    setOpen(false);
    if (notification.link) router.push(notification.link);
  };

  const markAllRead = async () => {
    setItems((prev) => prev.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })));
    setUnreadCount(0);
    try {
      await apiPost('/notifications/read-all', tokens?.accessToken, {});
    } catch (err) {
      console.error('Error marking all notifications as read:', err);
    }
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative p-2.5 rounded-lg hover:bg-gray-100 transition text-gray-500"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 max-h-[28rem] overflow-y-auto bg-white rounded-xl border border-gray-200 shadow-lg z-50">
          <div className="flex items-center justify-between p-3 border-b border-gray-100">
            <p className="text-sm font-bold text-gray-900">Notificaciones</p>
            {items.some((n) => !n.readAt) && (
              <button
                onClick={markAllRead}
                className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline"
              >
                <CheckCheck className="w-3.5 h-3.5" /> Marcar todas como leídas
              </button>
            )}
          </div>

          {loading ? (
            <div className="p-6 flex justify-center">
              <div className="animate-spin w-6 h-6 border-4 border-blue-200 border-t-blue-600 rounded-full" />
            </div>
          ) : items.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8 px-4">No tienes notificaciones todavía.</p>
          ) : (
            <div>
              {items.map((n) => (
                <button
                  key={n.id}
                  onClick={() => openNotification(n)}
                  className={`w-full text-left px-4 py-3 border-b border-gray-50 hover:bg-gray-50 flex gap-2 ${
                    !n.readAt ? 'bg-blue-50/50' : ''
                  }`}
                >
                  <span
                    className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${!n.readAt ? 'bg-blue-600' : 'bg-transparent'}`}
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900">{n.title}</p>
                    {n.body && <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{n.body}</p>}
                    <p className="text-[11px] text-gray-400 mt-1">{timeAgo(n.createdAt)}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
