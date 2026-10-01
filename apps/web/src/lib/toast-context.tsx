'use client';

import { createContext, useCallback, useContext, useRef, useState } from 'react';
import { CheckCircle2, XCircle, X } from 'lucide-react';

type ToastType = 'success' | 'error';
interface ToastItem {
  id: number;
  type: ToastType;
  message: string;
}

interface ToastContextValue {
  success: (message: string) => void;
  error: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (type: ToastType, message: string) => {
      const id = ++idRef.current;
      setToasts((current) => [...current, { id, type, message }]);
      setTimeout(() => dismiss(id), 4000);
    },
    [dismiss],
  );

  const value: ToastContextValue = {
    success: (message) => push('success', message),
    error: (message) => push('error', message),
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 w-[calc(100%-2rem)] max-w-sm">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`flex items-start gap-2.5 rounded-lg border bg-white px-4 py-3 shadow-lg text-sm ${
              t.type === 'success' ? 'border-emerald-200' : 'border-red-200'
            }`}
          >
            {t.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
            ) : (
              <XCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            )}
            <p className="flex-1 text-gray-700">{t.message}</p>
            <button onClick={() => dismiss(t.id)} className="text-gray-300 hover:text-gray-500 flex-shrink-0">
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within a ToastProvider');
  return ctx;
}
