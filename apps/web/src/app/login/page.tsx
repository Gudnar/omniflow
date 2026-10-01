'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { Eye, EyeOff, Mail, Lock, Globe, ChevronDown, Bot, ShoppingCart, LineChart } from 'lucide-react';
import { ProductShowcase } from '@/components/login/product-showcase';

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      router.push('/dashboard');
    } catch (err) {
      setError('Email o contraseña incorrectos');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-7xl bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col lg:flex-row">
        {/* Left side - Branding */}
        <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-blue-700 via-blue-700 to-blue-900 text-white p-10 xl:p-12 flex-col relative overflow-hidden">
          {/* Decorative dot grid */}
          <div
            className="absolute top-10 right-10 w-40 h-40 opacity-30 pointer-events-none"
            style={{
              backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.4) 1px, transparent 1px)',
              backgroundSize: '14px 14px',
            }}
          />

          {/* Decorative waves at bottom */}
          <svg className="absolute bottom-0 left-0 right-0 w-full h-56" viewBox="0 0 1200 220" preserveAspectRatio="none" style={{ opacity: 0.9 }}>
            <path d="M0,140 Q300,90 600,130 T1200,120 L1200,220 L0,220 Z" fill="#1d4ed8" opacity="0.6" />
            <path d="M0,160 Q250,110 550,150 T1200,150 L1200,220 L0,220 Z" fill="#22c55e" opacity="0.55" />
            <path d="M0,185 Q300,150 650,175 T1200,175 L1200,220 L0,220 Z" fill="#38bdf8" opacity="0.6" />
          </svg>

          {/* Logo */}
          <div className="relative z-10 mb-6 flex items-center gap-2">
            <svg className="w-9 h-9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              <circle cx="9" cy="10" r="1" fill="currentColor" />
              <circle cx="12" cy="10" r="1" fill="currentColor" />
              <circle cx="15" cy="10" r="1" fill="currentColor" />
            </svg>
            <h1 className="text-2xl font-bold">OmniFlow</h1>
          </div>

          {/* Heading */}
          <div className="relative z-10 mb-5">
            <h2 className="text-3xl xl:text-4xl font-bold mb-3 leading-tight">
              Conecta, gestiona y<br />
              haz crecer <span className="text-cyan-300">tu negocio</span>
            </h2>
            <p className="text-blue-100 text-sm max-w-sm">
              OmniFlow unifica conversaciones, clientes, ventas y operaciones en una sola plataforma impulsada por IA.
            </p>
          </div>

          {/* Features */}
          <div className="relative z-10 space-y-2.5 mb-5">
            <div className="flex gap-3 items-start">
              <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center flex-shrink-0">
                <Bot className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="font-bold text-sm mb-0.5">Agentes IA</h3>
                <p className="text-blue-100 text-xs">Atiende, vende y brinda soporte 24/7 por WhatsApp y otros canales.</p>
              </div>
            </div>

            <div className="flex gap-3 items-start">
              <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center flex-shrink-0">
                <ShoppingCart className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="font-bold text-sm mb-0.5">Ecommerce conversacional</h3>
                <p className="text-blue-100 text-xs">Catálogo, carrito y pagos dentro de la conversación.</p>
              </div>
            </div>

            <div className="flex gap-3 items-start">
              <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center flex-shrink-0">
                <LineChart className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="font-bold text-sm mb-0.5">Reportes en tiempo real</h3>
                <p className="text-blue-100 text-xs">Toma decisiones con dashboards e indicadores clave.</p>
              </div>
            </div>
          </div>

          {/* Trust: avatars */}
          <div className="relative z-10 flex items-center gap-3 mb-5">
            <div className="relative w-44 shrink-0" style={{ aspectRatio: '1774 / 887' }}>
              <Image
                src="/images/2.png"
                alt="Equipos que confían en OmniFlow"
                fill
                className="object-contain object-left mix-blend-multiply"
              />
            </div>
            <p className="text-blue-100 text-xs">Más de 1,000 empresas ya confían en OmniFlow</p>
          </div>

          {/* Product showcase mockup */}
          <div className="relative z-10 flex-1 flex items-start justify-center min-h-[220px]">
            <ProductShowcase />
          </div>
        </div>

        {/* Right side - Login Form */}
        <div className="w-full lg:w-1/2 flex flex-col justify-center px-6 sm:px-12 lg:px-14 py-10 lg:py-12 relative">
          {/* Language selector */}
          <div className="flex justify-end mb-10 lg:mb-14">
            <button className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 text-sm font-medium transition-colors">
              <Globe className="w-4 h-4" />
              Español
              <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
            </button>
          </div>

          <div className="max-w-md w-full mx-auto lg:mx-0">
            {/* Header */}
            <div className="mb-8">
              <h2 className="text-3xl font-bold text-gray-900 mb-2">Bienvenido de nuevo</h2>
              <p className="text-gray-500 text-base">Inicia sesión para continuar en OmniFlow</p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm font-medium">
                  {error}
                </div>
              )}

              {/* Email */}
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">Correo electrónico</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-gray-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail((e.target as HTMLInputElement).value)}
                    placeholder="ejemplo@empresa.com"
                    className="w-full pl-11 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 placeholder-gray-400"
                    required
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-semibold text-gray-900">Contraseña</label>
                  <button type="button" className="text-sm text-blue-600 hover:text-blue-700 font-medium transition-colors">
                    ¿Olvidaste tu contraseña?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-gray-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword((e.target as HTMLInputElement).value)}
                    placeholder="Tu contraseña"
                    className="w-full pl-11 pr-12 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 placeholder-gray-400"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {/* Remember me checkbox */}
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="remember"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe((e.target as HTMLInputElement).checked)}
                  className="w-5 h-5 border border-gray-300 rounded cursor-pointer accent-blue-600"
                />
                <label htmlFor="remember" className="text-sm text-gray-700 cursor-pointer font-medium">
                  Recuérdame
                </label>
              </div>

              {/* Submit button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold py-3 rounded-lg transition-colors text-base mt-2"
              >
                {loading ? 'Iniciando sesión...' : 'Iniciar sesión'}
              </button>
            </form>

            {/* Divider */}
            <div className="mt-8 mb-6">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-200"></div>
                </div>
                <div className="relative flex justify-center">
                  <span className="px-3 bg-white text-gray-500 text-sm font-medium">o continúa con</span>
                </div>
              </div>
            </div>

            {/* OAuth buttons */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { name: 'Google', icon: '🔍' },
                { name: 'Microsoft', icon: '⊞' },
                { name: 'Apple', icon: '🍎' },
              ].map((provider) => (
                <button
                  key={provider.name}
                  type="button"
                  className="py-2.5 px-3 border border-gray-300 rounded-lg hover:bg-gray-50 active:bg-gray-100 transition-colors flex items-center justify-center gap-2"
                >
                  <span className="text-base">{provider.icon}</span>
                  <span className="text-sm text-gray-700 font-medium">{provider.name}</span>
                </button>
              ))}
            </div>

            {/* Sign up link */}
            <div className="text-center mt-8">
              <p className="text-gray-600 text-sm">
                ¿No tienes una cuenta?{' '}
                <Link href="/register" className="text-blue-600 hover:text-blue-700 font-semibold transition-colors">
                  Solicita una demostración
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <p className="text-gray-400 text-xs mt-6">© 2026 OmniFlow. Todos los derechos reservados.</p>
    </div>
  );
}
