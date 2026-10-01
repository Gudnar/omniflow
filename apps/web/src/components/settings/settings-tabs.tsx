'use client';

import {
  Settings,
  ShoppingCart,
  Truck,
  CalendarClock,
  CreditCard,
  Bell,
  Users,
  Puzzle,
} from 'lucide-react';
import { settingsTabs } from './mock-data';

const TAB_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  general: Settings,
  ecommerce: ShoppingCart,
  orders: Truck,
  bookings: CalendarClock,
  payments: CreditCard,
  notifications: Bell,
  users: Users,
  integrations: Puzzle,
};

export function SettingsTabs({
  active,
  onChange,
}: {
  active: string;
  onChange: (key: string) => void;
}) {
  return (
    <div className="flex border-b border-gray-200 overflow-x-auto">
      {settingsTabs.map((tab) => {
        const Icon = TAB_ICONS[tab.key];
        const isActive = active === tab.key;
        return (
          <button
            key={tab.key}
            onClick={() => onChange(tab.key)}
            className={`flex items-center gap-2 px-4 py-3.5 text-sm font-medium border-b-2 whitespace-nowrap transition ${
              isActive
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Icon className="w-4 h-4" />
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
