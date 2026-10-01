import { io, Socket } from 'socket.io-client';
import { TOKENS_REFRESHED_EVENT, refreshAccessToken } from './api-client';

// The socket connects DIRECTLY to the API's own origin, not through Next's
// `/api/*` rewrite proxy (used by every plain fetch in api-client.ts) — a
// WebSocket upgrade isn't guaranteed to survive that HTTP-oriented rewrite,
// so this is deliberately a separate, explicit cross-origin connection (the
// gateway's CORS config allows it).
const API_ORIGIN = process.env.NEXT_PUBLIC_API_ORIGIN || 'http://localhost:3001';

let staffSocket: Socket | null = null;
let staffSocketToken: string | null = null;

// Idempotent: reuses the existing connection unless the access token
// changed (e.g. after a silent refresh — see the TOKENS_REFRESHED_EVENT
// listener below), so multiple chat-panel mounts never open extra sockets.
export function getStaffSocket(token: string): Socket {
  if (staffSocket && staffSocketToken === token) return staffSocket;
  staffSocket?.disconnect();
  staffSocket = io(API_ORIGIN, { auth: { token } });
  staffSocketToken = token;

  // A long-lived tab's 15-minute access token eventually expires; the next
  // time this socket needs to (re)connect, RealtimeGateway.handleConnection
  // rejects the stale token and calls client.disconnect() — a
  // SERVER-initiated disconnect, which Socket.IO deliberately does NOT
  // auto-reconnect from (only network-drop disconnects retry on their own).
  // Without this, real-time updates would silently stop for the rest of the
  // tab's life. Refreshing here feeds a new token to the
  // TOKENS_REFRESHED_EVENT listener below, which creates a fresh socket.
  staffSocket.on('disconnect', (reason) => {
    if (reason === 'io server disconnect') {
      refreshAccessToken();
    }
  });

  return staffSocket;
}

if (typeof window !== 'undefined') {
  window.addEventListener(TOKENS_REFRESHED_EVENT, (e: Event) => {
    const detail = (e as CustomEvent).detail as { accessToken?: string } | undefined;
    if (staffSocket && detail?.accessToken) {
      getStaffSocket(detail.accessToken);
    }
  });
}

export function joinConversation(conversationId: string) {
  staffSocket?.emit('join:conversation', { conversationId });
}

export function leaveConversation(conversationId: string) {
  staffSocket?.emit('leave:conversation', { conversationId });
}

// One connection per widget instance — a visitor's webchatToken scopes it to
// exactly one conversation, so there's no "join" step (the gateway auto-joins
// on handshake) and no reuse concern like the staff socket has.
export function connectAsVisitor(webchatToken: string): Socket {
  const socket = io(API_ORIGIN, { auth: { webchatToken } });
  // webchatToken itself never expires, so unlike the staff socket above
  // there's no token to refresh — but the same "server-initiated disconnect
  // never auto-reconnects" gap applies to any transient server-side hiccup
  // (e.g. a DB lookup failing mid-restart), so a plain manual reconnect
  // attempt is enough here.
  socket.on('disconnect', (reason) => {
    if (reason === 'io server disconnect') {
      socket.connect();
    }
  });
  return socket;
}

export type NewMessagePayload = { conversationId: string };
