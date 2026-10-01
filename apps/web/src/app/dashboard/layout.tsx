'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { Sidebar } from '@/components/dashboard/sidebar';
import { Header } from '@/components/dashboard/header';
import { X } from 'lucide-react';

const TITLES: Record<string, string> = {
  '/dashboard': 'Inicio',
  '/dashboard/branches': 'Sucursales',
  '/dashboard/conversations': 'Conversaciones',
  '/dashboard/contacts': 'Contactos',
  '/dashboard/crm': 'CRM',
  '/dashboard/settings': 'Configuración',
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isLoading } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/login');
    }
  }, [isLoading, user, router]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="animate-spin w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando...</p>
        </div>
      </div>
    );
  }

  const title = TITLES[pathname] || 'Inicio';

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <Sidebar />

      {/* Mobile sidebar drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setMobileOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 flex">
            <div className="relative">
              <Sidebar className="flex" />
              <button
                onClick={() => setMobileOpen(false)}
                className="absolute top-4 -right-10 p-2 rounded-lg bg-white/10 text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <Header title={title} onMenuClick={() => setMobileOpen(true)} />
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
