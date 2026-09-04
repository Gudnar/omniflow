'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { Eye, EyeOff } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
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
    <div className="min-h-screen flex bg-white">
      {/* Left side - Branding (Blue Gradient) */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-b from-blue-700 via-blue-600 to-blue-900 text-white p-8 flex-col justify-between relative overflow-hidden">
        {/* Decorative waves at bottom */}
        <svg className="absolute bottom-0 left-0 right-0 w-full h-40" viewBox="0 0 1200 200" preserveAspectRatio="none" style={{ opacity: 0.2 }}>
          <path d="M0,100 Q300,50 600,100 T1200,100 L1200,200 L0,200 Z" fill="#10b981" />
        </svg>
        <svg className="absolute bottom-12 left-0 right-0 w-full h-32" viewBox="0 0 1200 100" preserveAspectRatio="none" style={{ opacity: 0.15 }}>
          <path d="M0,50 Q200,20 400,50 T800,50 T1200,50 L1200,100 L0,100 Z" fill="#06b6d4" />
        </svg>

        {/* Top Logo */}
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-8">
            <div className="w-10 h-10 bg-white/25 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                <circle cx="9" cy="10" r="1" fill="currentColor" />
                <circle cx="12" cy="10" r="1" fill="currentColor" />
                <circle cx="15" cy="10" r="1" fill="currentColor" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold">OmniFlow</h1>
          </div>

          {/* Main Heading */}
          <h2 className="text-4xl font-bold mb-4 leading-tight">
            Conecta, gestiona y<br />
            <span className="text-blue-200">haz crecer tu negocio</span>
          </h2>
          <p className="text-blue-100 text-sm mb-12 max-w-sm">
            OmniFlow unifica conversaciones, clientes, ventas y operaciones en una sola plataforma impulsada por IA.
          </p>
        </div>

        {/* Dashboard Mockup */}
        <div className="relative z-10 mx-auto mb-8 w-full max-w-xs">
          <div className="bg-white/10 backdrop-blur-md rounded-2xl overflow-hidden border border-white/20 shadow-2xl">
            {/* Dashboard header */}
            <div className="bg-gradient-to-r from-blue-500 to-blue-600 px-4 py-3 flex items-center gap-2">
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-white/40 rounded-full"></div>
                <div className="w-2 h-2 bg-white/60 rounded-full"></div>
                <div className="w-2 h-2 bg-white/80 rounded-full"></div>
              </div>
              <span className="text-white text-xs font-semibold ml-auto">Dashboard</span>
            </div>

            {/* Dashboard content */}
            <div className="p-3 space-y-3">
              {/* Stat card */}
              <div className="bg-white/95 rounded-lg p-3">
                <div className="flex justify-between items-start mb-2">
                  <span className="text-gray-600 text-xs font-medium">Ventas hoy</span>
                  <span className="text-green-600 text-xs font-bold">↑ 12.5%</span>
                </div>
                <div className="text-xl font-bold text-gray-900">Bs. 24,650</div>
              </div>

              {/* Stats row */}
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-white/90 rounded-lg p-2">
                  <div className="text-xs text-gray-600 mb-1">Conversaciones</div>
                  <div className="text-lg font-bold text-gray-900">128</div>
                </div>
                <div className="bg-white/90 rounded-lg p-2">
                  <div className="text-xs text-gray-600 mb-1">Tasa cierre</div>
                  <div className="text-lg font-bold text-green-600">↑ 12.8%</div>
                </div>
              </div>

              {/* Mini chart */}
              <div className="bg-white/90 rounded-lg p-2">
                <div className="text-xs text-gray-600 mb-2">Ventas últimos 7 días</div>
                <div className="h-12 bg-gradient-to-r from-blue-100 to-blue-200 rounded flex items-end justify-around px-1 py-2">
                  <div className="w-1 h-4 bg-blue-500 rounded-t"></div>
                  <div className="w-1 h-6 bg-blue-600 rounded-t"></div>
                  <div className="w-1 h-5 bg-blue-500 rounded-t"></div>
                  <div className="w-1 h-8 bg-blue-600 rounded-t"></div>
                  <div className="w-1 h-7 bg-blue-500 rounded-t"></div>
                  <div className="w-1 h-9 bg-blue-600 rounded-t"></div>
                  <div className="w-1 h-6 bg-blue-500 rounded-t"></div>
                </div>
              </div>

              {/* Channel list */}
              <div className="bg-white/90 rounded-lg p-2">
                <div className="text-xs text-gray-600 font-medium mb-2">Canales principales</div>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-gray-700">WhatsApp</span>
                    <span className="font-bold text-gray-900">108</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-700">Instagram</span>
                    <span className="font-bold text-gray-900">64</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-700">Facebook</span>
                    <span className="font-bold text-gray-900">32</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Features List */}
        <div className="relative z-10 space-y-3 mb-8">
          <div className="flex gap-3">
            <div className="w-10 h-10 bg-blue-500 rounded flex items-center justify-center flex-shrink-0">
              <span className="text-white text-lg">🤖</span>
            </div>
            <div>
              <h3 className="font-bold text-sm">Agentes IA</h3>
              <p className="text-blue-100 text-xs">Atiende, vende y brinda soporte 24/7</p>
            </div>
          </div>

          <div className="flex gap-3">
            <div className="w-10 h-10 bg-blue-500 rounded flex items-center justify-center flex-shrink-0">
              <span className="text-white text-lg">🛒</span>
            </div>
            <div>
              <h3 className="font-bold text-sm">Ecommerce conversacional</h3>
              <p className="text-blue-100 text-xs">Catálogo y pagos en la conversación</p>
            </div>
          </div>

          <div className="flex gap-3">
            <div className="w-10 h-10 bg-blue-500 rounded flex items-center justify-center flex-shrink-0">
              <span className="text-white text-lg">📊</span>
            </div>
            <div>
              <h3 className="font-bold text-sm">Reportes en tiempo real</h3>
              <p className="text-blue-100 text-xs">Dashboards e indicadores clave</p>
            </div>
          </div>
        </div>

        {/* Bottom: User Avatars */}
        <div className="flex items-center gap-2 relative z-10">
          <div className="flex -space-x-2">
            {[
              { initials: 'MJ', color: 'bg-pink-500' },
              { initials: 'JD', color: 'bg-blue-500' },
              { initials: 'AR', color: 'bg-green-500' },
              { initials: 'SL', color: 'bg-purple-500' },
            ].map((avatar, i) => (
              <div
                key={i}
                className={`w-8 h-8 ${avatar.color} rounded-full border-2 border-blue-700 flex items-center justify-center text-xs font-bold text-white`}
              >
                {avatar.initials}
              </div>
            ))}
          </div>
          <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-xs font-bold text-white">
            +995
          </div>
          <p className="text-blue-100 text-xs">Más de 1.000 empresas confían en OmniFlow</p>
        </div>
      </div>

      {/* Right side - Login Form */}
      <div className="w-full lg:w-1/2 flex flex-col justify-center px-8 sm:px-12 py-12">
        <div className="max-w-md w-full">
          {/* Language selector */}
          <div className="flex justify-end mb-16">
            <button className="flex items-center gap-2 text-gray-600 hover:text-gray-900 text-sm font-medium">
              <span>🌐</span> Español
            </button>
          </div>

          {/* Header */}
          <div className="mb-10">
            <h2 className="text-4xl font-bold text-gray-900 mb-3">Bienvenido de nuevo</h2>
            <p className="text-gray-500 text-base">Inicia sesión para continuar en OmniFlow</p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm font-medium">
                {error}
              </div>
            )}

            {/* Email */}
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">Correo electrónico</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail((e.target as HTMLInputElement).value)}
                placeholder="ejemplo@empresa.com"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 placeholder-gray-400"
                required
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">Contraseña</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword((e.target as HTMLInputElement).value)}
                  placeholder="Tu contraseña"
                  className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 placeholder-gray-400"
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
              <button type="button" className="text-sm text-blue-600 hover:text-blue-700 mt-2 font-medium transition-colors">
                ¿Olvidaste tu contraseña?
              </button>
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
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold py-3 rounded-lg transition-colors text-base mt-8"
            >
              {loading ? 'Iniciando sesión...' : 'Iniciar sesión'}
            </button>
          </form>

          {/* Divider */}
          <div className="mt-10 mb-6">
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
                className="py-3 px-4 border border-gray-300 rounded-lg hover:bg-gray-50 active:bg-gray-100 transition-colors flex flex-col items-center justify-center gap-2"
              >
                <span className="text-xl">{provider.icon}</span>
                <span className="text-xs text-gray-700 font-medium">{provider.name}</span>
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

          {/* Footer */}
          <div className="text-center mt-12 pt-8 border-t border-gray-100">
            <p className="text-gray-500 text-xs">
              © 2026 OmniFlow. Todos los derechos reservados.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
