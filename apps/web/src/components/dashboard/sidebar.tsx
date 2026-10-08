'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import {
  MessageCircle,
  Home,
  MessageSquare,
  Users,
  UserPlus,
  Contact,
  Workflow,
  Megaphone,
  FileText,
  Bot,
  ShoppingBag,
  Package,
  ShoppingCart,
  Tag,
  Building2,
  CalendarDays,
  UserCog,
  BarChart3,
  LineChart,
  Settings,
  ChevronDown,
  MoreVertical,
  Link2,
  ShieldCheck,
} from 'lucide-react';

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
}

const navGroups: NavItem[][] = [
  [
    { label: 'Inicio', href: '/dashboard', icon: Home },
    { label: 'Conversaciones', href: '/dashboard/conversations', icon: MessageSquare, badge: 12 },
    { label: 'Comentarios', href: '/dashboard/facebook-comments', icon: MessageCircle },
    { label: 'Contactos', href: '/dashboard/contacts', icon: Users },
    { label: 'Leads', href: '#', icon: UserPlus },
    { label: 'CRM', href: '/dashboard/crm', icon: Contact },
    { label: 'Flujos (Automatizaciones)', href: '/dashboard/flows', icon: Workflow },
    { label: 'Campañas', href: '/dashboard/campaigns', icon: Megaphone },
    { label: 'Plantillas', href: '/dashboard/templates', icon: FileText },
    { label: 'IA Agents', href: '/dashboard/ai-agents', icon: Bot },
  ],
  [
    { label: 'Ecommerce', href: '#', icon: ShoppingBag },
    { label: 'Productos', href: '/dashboard/products', icon: Package },
    { label: 'Pedidos', href: '/dashboard/orders', icon: ShoppingCart },
    { label: 'Promociones', href: '#', icon: Tag },
    { label: 'Sucursales', href: '/dashboard/branches', icon: Building2 },
    { label: 'Página de Enlaces', href: '/dashboard/link-page', icon: Link2 },
  ],
  [
    { label: 'Reservas y Citas', href: '/dashboard/booking', icon: CalendarDays },
    { label: 'Especialistas', href: '#', icon: UserCog },
  ],
  [
    { label: 'Reportes', href: '#', icon: BarChart3 },
    { label: 'Analytics', href: '#', icon: LineChart },
  ],
  [
    { label: 'Usuarios', href: '/dashboard/users', icon: ShieldCheck },
    { label: 'Configuración', href: '/dashboard/settings', icon: Settings },
  ],
];

export function Sidebar({ className = 'hidden lg:flex' }: { className?: string }) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const router = useRouter();

  return (
    <aside
      className={`${className} lg:flex-col w-[260px] shrink-0 h-screen bg-[#0B1220] text-slate-300 border-r border-white/5`}
    >
      {/* Logo */}
      <div className="h-16 flex items-center gap-2 px-5 shrink-0">
        <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
          <MessageCircle className="w-5 h-5 text-blue-400" />
        </div>
        <span className="text-white font-bold text-lg tracking-tight">OmniFlow</span>
      </div>

      {/* Tenant selector */}
      <div className="px-4 pb-3">
        <button className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg bg-white/5 hover:bg-white/10 transition text-sm text-slate-200">
          <Building2 className="w-4 h-4 text-slate-400 shrink-0" />
          <span className="flex-1 text-left truncate">Demo Company</span>
          <ChevronDown className="w-4 h-4 text-slate-500 shrink-0" />
        </button>
      </div>

      {/* Navigation */}
      <nav className="sidebar-scroll flex-1 overflow-y-auto px-3 pb-4 space-y-5">
        {navGroups.map((group, gi) => (
          <div key={gi} className="space-y-0.5">
            {group.map((item) => {
              const isActive = item.href !== '#' && pathname === item.href;
              const Icon = item.icon;
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${
                    isActive
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-300 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <Icon className="w-[18px] h-[18px] shrink-0" />
                  <span className="flex-1 truncate">{item.label}</span>
                  {item.badge ? (
                    <span
                      className={`text-xs font-semibold rounded-full px-1.5 py-0.5 min-w-[20px] text-center ${
                        isActive ? 'bg-white/20 text-white' : 'bg-white/10 text-slate-300'
                      }`}
                    >
                      {item.badge}
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* User footer */}
      <div className="shrink-0 border-t border-white/5 p-3">
        <button
          onClick={() => {
            logout();
            router.push('/login');
          }}
          className="w-full flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-white/5 transition text-left"
        >
          <div className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center text-white text-sm font-semibold shrink-0">
            {(user?.email?.[0] || 'A').toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white truncate">
              {user?.email?.split('@')[0] || 'Usuario'}
            </p>
            <p className="text-xs text-slate-500 truncate">Administrador</p>
          </div>
          <MoreVertical className="w-4 h-4 text-slate-500 shrink-0" />
        </button>
      </div>
    </aside>
  );
}
