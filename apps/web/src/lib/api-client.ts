import type { AuthTokens } from '@omniflow/types';

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

// Custom event name auth-context.tsx listens on to sync its React state
// (and therefore every component reading `tokens` from useAuth()) whenever
// this module silently refreshes the access token behind a 401.
export const TOKENS_REFRESHED_EVENT = 'auth-tokens-refreshed';
export const TOKENS_EXPIRED_EVENT = 'auth-tokens-expired';

// The access token is short-lived (15 min, see AuthService.generateTokens).
// Previously nothing ever used the refreshToken already sitting in
// localStorage, so any session left open past 15 minutes failed every
// request with "Invalid or missing JWT token" until a manual re-login.
// De-duplicated so concurrent 401s from several in-flight requests only
// trigger one /auth/refresh call.
let refreshPromise: Promise<string | null> | null = null;

// Exported for socket-client.ts: a socket the server actively disconnects
// (e.g. an expired JWT on reconnect) does NOT auto-reconnect on its own —
// that's Socket.IO's documented behavior for a server-initiated disconnect,
// unlike a network drop. Reusing this same refresh (rather than a second,
// divergent one) keeps a single source of truth for the token and still
// de-dupes concurrent callers via refreshPromise.
export async function refreshAccessToken(): Promise<string | null> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    try {
      const stored = typeof window !== 'undefined' ? window.localStorage.getItem('auth_tokens') : null;
      if (!stored) return null;
      const current: AuthTokens = JSON.parse(stored);
      if (!current.refreshToken) return null;

      const res = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: current.refreshToken }),
      });
      if (!res.ok) {
        window.dispatchEvent(new Event(TOKENS_EXPIRED_EVENT));
        return null;
      }

      const next: AuthTokens = await res.json();
      window.localStorage.setItem('auth_tokens', JSON.stringify(next));
      window.dispatchEvent(new CustomEvent<AuthTokens>(TOKENS_REFRESHED_EVENT, { detail: next }));
      return next.accessToken;
    } catch {
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

async function request<T>(path: string, accessToken: string | undefined, init?: RequestInit): Promise<T> {
  const doFetch = (token: string | undefined) =>
    fetch(`/api${path}`, {
      ...init,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        // FormData sets its own multipart boundary — forcing JSON here
        // would break file uploads.
        ...(init?.body && !(init.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
        ...init?.headers,
      },
    });

  let res = await doFetch(accessToken);

  // A 401 on an already-authenticated call almost always means the access
  // token expired mid-session — try once to refresh and replay the request
  // before surfacing an error. /auth/refresh and /auth/login themselves are
  // exempt to avoid a refresh-loop on a genuinely invalid credential.
  if (res.status === 401 && accessToken && !path.startsWith('/auth/')) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      res = await doFetch(newToken);
    }
  }

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new ApiError(res.status, body?.error?.message ?? `Request failed (${res.status})`);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

export const apiGet = <T>(path: string, token?: string) => request<T>(path, token);

export const apiPost = <T>(path: string, token: string | undefined, data: unknown) =>
  request<T>(path, token, { method: 'POST', body: JSON.stringify(data) });

export const apiPatch = <T>(path: string, token: string | undefined, data: unknown) =>
  request<T>(path, token, { method: 'PATCH', body: JSON.stringify(data) });

export const apiDelete = <T>(path: string, token?: string) => request<T>(path, token, { method: 'DELETE' });

export const apiUpload = <T>(path: string, token: string | undefined, formData: FormData) =>
  request<T>(path, token, { method: 'POST', body: formData });

// For a binary response (file download) that `request()` can't handle —
// it always parses JSON. Same 401-refresh-and-replay as request() above,
// so an expired access token doesn't surface as a failed download.
export async function apiDownload(path: string, token: string | undefined, filename: string): Promise<void> {
  const doFetch = (t: string | undefined) =>
    fetch(`/api${path}`, { headers: t ? { Authorization: `Bearer ${t}` } : {} });

  let res = await doFetch(token);
  if (res.status === 401 && token) {
    const newToken = await refreshAccessToken();
    if (newToken) res = await doFetch(newToken);
  }
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new ApiError(res.status, body?.error?.message ?? `Request failed (${res.status})`);
  }

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
