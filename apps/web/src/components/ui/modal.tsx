'use client';

import { X } from 'lucide-react';
import type { ReactNode } from 'react';

const SIZE_CLASSES: Record<'md' | 'lg' | 'xl', string> = {
  md: 'max-w-md',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
};

export function Modal({
  open,
  onClose,
  title,
  size = 'md',
  children,
}: {
  open: boolean;
  onClose: () => void;
  // Omit title when `children` is already a self-contained card with its own
  // header/close button (e.g. ProductDetailPanel) — the modal then only
  // provides the centered overlay, not a second header.
  title?: string;
  size?: 'md' | 'lg' | 'xl';
  children: ReactNode;
}) {
  if (!open) return null;

  if (!title) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
        <div className={`${SIZE_CLASSES[size]} w-full max-h-[90vh]`}>{children}</div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className={`bg-white rounded-xl border border-gray-200 ${SIZE_CLASSES[size]} w-full max-h-[90vh] overflow-y-auto`}>
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h2 className="text-base font-bold text-gray-900">{title}</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 text-gray-400 transition">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
