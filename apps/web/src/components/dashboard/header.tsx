'use client';

import { Menu, Search, HelpCircle } from 'lucide-react';
import { NotificationsBell } from './notifications-bell';

export function Header({ title, onMenuClick }: { title: string; onMenuClick?: () => void }) {
  return (
    <header className="h-16 shrink-0 bg-white border-b border-gray-200 flex items-center justify-between px-4 sm:px-6">
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="p-2 -ml-2 rounded-lg hover:bg-gray-100 transition text-gray-600 lg:hidden"
        >
          <Menu className="w-5 h-5" />
        </button>
        <button className="hidden lg:block p-2 -ml-2 rounded-lg hover:bg-gray-100 transition text-gray-500">
          <Menu className="w-5 h-5" />
        </button>
        <h1 className="text-lg font-semibold text-gray-900">{title}</h1>
      </div>

      <div className="flex items-center gap-1 sm:gap-2">
        <button className="p-2.5 rounded-lg hover:bg-gray-100 transition text-gray-500">
          <Search className="w-5 h-5" />
        </button>
        <NotificationsBell />
        <button className="p-2.5 rounded-lg hover:bg-gray-100 transition text-gray-500">
          <HelpCircle className="w-5 h-5" />
        </button>
      </div>
    </header>
  );
}
