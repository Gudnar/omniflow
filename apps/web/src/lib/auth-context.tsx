'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { AuthResponse, AuthTokens } from '@omniflow/types';
import { TOKENS_REFRESHED_EVENT, TOKENS_EXPIRED_EVENT } from './api-client';

interface AuthContextType {
  user: { id: string; email: string; tenantId: string; mfaEnabled: boolean } | null;
  tokens: AuthTokens | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (tenantName: string, email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthContextType['user']>(null);
  const [tokens, setTokens] = useState<AuthTokens | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem('auth_tokens');
    if (stored) {
      const parsed = JSON.parse(stored);
      setTokens(parsed);
      const userStored = localStorage.getItem('auth_user');
      if (userStored) {
        setUser(JSON.parse(userStored));
      }
    }
    setIsLoading(false);
  }, []);

  // api-client.ts refreshes the access token itself behind a 401 (it has no
  // access to this component's state), then broadcasts the result here so
  // every screen reading `tokens`/`user` from useAuth() picks up the new
  // token instead of continuing to send the expired one.
  useEffect(() => {
    const onRefreshed = (e: Event) => {
      const next = (e as CustomEvent<AuthTokens>).detail;
      setTokens(next);
      localStorage.setItem('auth_tokens', JSON.stringify(next));
    };
    const onExpired = () => logout();

    window.addEventListener(TOKENS_REFRESHED_EVENT, onRefreshed);
    window.addEventListener(TOKENS_EXPIRED_EVENT, onExpired);
    return () => {
      window.removeEventListener(TOKENS_REFRESHED_EVENT, onRefreshed);
      window.removeEventListener(TOKENS_EXPIRED_EVENT, onExpired);
    };
  }, []);

  const login = async (email: string, password: string) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) throw new Error('Login failed');
    const data: AuthResponse = await res.json();
    setTokens({ accessToken: data.accessToken, refreshToken: data.refreshToken, expiresIn: data.expiresIn });
    setUser(data.user);
    localStorage.setItem('auth_tokens', JSON.stringify({ accessToken: data.accessToken, refreshToken: data.refreshToken, expiresIn: data.expiresIn }));
    localStorage.setItem('auth_user', JSON.stringify(data.user));
  };

  const register = async (tenantName: string, email: string, password: string) => {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenantName, email, password }),
    });
    if (!res.ok) throw new Error('Registration failed');
    const data: AuthResponse = await res.json();
    setTokens({ accessToken: data.accessToken, refreshToken: data.refreshToken, expiresIn: data.expiresIn });
    setUser(data.user);
    localStorage.setItem('auth_tokens', JSON.stringify({ accessToken: data.accessToken, refreshToken: data.refreshToken, expiresIn: data.expiresIn }));
    localStorage.setItem('auth_user', JSON.stringify(data.user));
  };

  const logout = () => {
    setUser(null);
    setTokens(null);
    localStorage.removeItem('auth_tokens');
    localStorage.removeItem('auth_user');
  };

  return (
    <AuthContext.Provider value={{ user, tokens, isLoading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
