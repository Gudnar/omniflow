'use client';

import { useState } from 'react';
import { SettingsTabs } from '@/components/settings/settings-tabs';
import { GeneralTab } from '@/components/settings/general-tab';
import { IntegrationsTab } from '@/components/settings/integrations-tab';
import { EcommerceTab } from '@/components/settings/ecommerce-tab';
import { OrdersTab } from '@/components/settings/orders-tab';
import { BookingsTab } from '@/components/settings/bookings-tab';
import { PaymentsTab } from '@/components/settings/payments-tab';
import { NotificationsTab } from '@/components/settings/notifications-tab';
import { PlaceholderTab } from '@/components/settings/placeholder-tab';
import { settingsTabs } from '@/components/settings/mock-data';

const KNOWN_TABS = ['general', 'ecommerce', 'orders', 'bookings', 'payments', 'notifications', 'integrations'];

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('general');

  const activeLabel = settingsTabs.find((t) => t.key === activeTab)?.label || '';

  return (
    <div className="max-w-[1800px] mx-auto px-4 sm:px-6 py-6 space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Configuración</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Administra los ajustes generales de tu cuenta, negocio y preferencias.
        </p>
      </div>

      <div className="bg-transparent">
        <SettingsTabs active={activeTab} onChange={setActiveTab} />
      </div>

      <div className="pt-1">
        {activeTab === 'general' && <GeneralTab />}
        {activeTab === 'ecommerce' && <EcommerceTab />}
        {activeTab === 'orders' && <OrdersTab />}
        {activeTab === 'bookings' && <BookingsTab />}
        {activeTab === 'payments' && <PaymentsTab />}
        {activeTab === 'notifications' && <NotificationsTab />}
        {activeTab === 'integrations' && <IntegrationsTab />}
        {!KNOWN_TABS.includes(activeTab) && <PlaceholderTab label={activeLabel} />}
      </div>
    </div>
  );
}
