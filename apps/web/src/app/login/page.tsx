'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';

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
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-b from-blue-700 via-blue-700 to-blue-900 text-white p-12 flex-col justify-between relative overflow-hidden">
        {/* Decorative wave at bottom */}
        <div className="absolute bottom-0 left-0 right-0 h-24" style={{
          background: 'linear-gradient(135deg, #3b82f6 0%, #10b981 100%)',
          clipPath: 'polygon(0 40%, 100% 20%, 100% 100%, 0% 100%)',
          opacity: 0.3
        }}></div>

        {/* Top Logo */}
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-16">
            <div className="w-12 h-12 bg-white/25 rounded-lg flex items-center justify-center">
              <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold">OmniFlow</h1>
          </div>

          {/* Main Heading */}
          <div className="mb-16">
            <h2 className="text-4xl font-bold mb-6 leading-tight">
              Conecta, gestiona y<br />
              <span className="text-blue-200">haz crecer tu negocio</span>
            </h2>
            <p className="text-blue-100 text-base leading-relaxed max-w-md">
              OmniFlow unifica conversaciones, clientes, ventas y operaciones en una sola plataforma impulsada por IA.
            </p>
          </div>

          {/* Features List */}
          <div className="space-y-5">
            {/* Feature 1: Agents */}
            <div className="flex gap-4">
              <div className="w-14 h-14 bg-blue-500 rounded-lg flex items-center justify-center flex-shrink-0">
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h3 className="font-bold text-base mb-1">Agentes IA</h3>
                <p className="text-blue-100 text-sm">Atiende, vende y brinda soporte 24/7 por WhatsApp y otros canales.</p>
              </div>
            </div>

            {/* Feature 2: Ecommerce */}
            <div className="flex gap-4">
              <div className="w-14 h-14 bg-blue-500 rounded-lg flex items-center justify-center flex-shrink-0">
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <div>
                <h3 className="font-bold text-base mb-1">Ecommerce conversacional</h3>
                <p className="text-blue-100 text-sm">Catálogo, carrito y pagos dentro de la conversación.</p>
              </div>
            </div>

            {/* Feature 3: Reports */}
            <div className="flex gap-4">
              <div className="w-14 h-14 bg-blue-500 rounded-lg flex items-center justify-center flex-shrink-0">
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7H5v12h12V9m0-2h6m0 0v6m0-6L9 17" />
                </svg>
              </div>
              <div>
                <h3 className="font-bold text-base mb-1">Reportes en tiempo real</h3>
                <p className="text-blue-100 text-sm">Toma decisiones con dashboards e indicadores clave.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom: User Avatars */}
        <div className="flex items-center gap-2 relative z-10">
          <div className="flex -space-x-3">
            {['👩', '👨', '👩', '👨'].map((emoji, i) => (
              <div
                key={i}
                className="w-10 h-10 bg-white/20 rounded-full border-2 border-blue-600 flex items-center justify-center text-sm"
              >
                {emoji}
              </div>
            ))}
          </div>
          <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-xs font-bold">
            +4995
          </div>
          <p className="text-blue-100 text-xs ml-2">Más de 1.000 empresas ya confían en OmniFlow</p>
        </div>
      </div>

      {/* Right side - Login Form */}
      <div className="w-full lg:w-1/2 flex flex-col justify-center px-8 sm:px-16 py-12">
        <div className="max-w-md w-full">
          {/* Language selector */}
          <div className="flex justify-end mb-12">
            <button className="flex items-center gap-2 text-gray-600 hover:text-gray-900 text-sm font-medium">
              <span>🌐</span> Español
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
              </svg>
            </button>
          </div>

          {/* Header */}
          <div className="mb-8">
            <h2 className="text-3xl font-bold text-gray-900 mb-2">Bienvenido de nuevo</h2>
            <p className="text-gray-500 text-sm">Inicia sesión para continuar en OmniFlow</p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {error}
              </div>
            )}

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">Correo electrónico</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ejemplo@empresa.com"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                required
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">Contraseña</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Tu contraseña"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? '👁️' : '👁️‍🗨️'}
                </button>
              </div>
              <a href="#" className="text-xs text-blue-600 hover:text-blue-700 mt-2 inline-block font-medium">
                ¿Olvidaste tu contraseña?
              </a>
            </div>

            {/* Remember me checkbox */}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="remember"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 border border-gray-300 rounded bg-white checked:bg-blue-600 checked:border-blue-600 cursor-pointer"
              />
              <label htmlFor="remember" className="text-sm text-gray-700 cursor-pointer">
                Recuérdame
              </label>
            </div>

            {/* Submit button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold py-3 rounded-lg transition-colors text-sm"
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
                <span className="px-3 bg-white text-gray-500 text-xs font-medium">o continúa con</span>
              </div>
            </div>
          </div>

          {/* OAuth buttons */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { name: 'Google', symbol: 'G' },
              { name: 'Microsoft', symbol: '⊟' },
              { name: 'Apple', symbol: '🍎' },
            ].map((provider) => (
              <button
                key={provider.name}
                type="button"
                className="py-3 px-4 border border-gray-300 rounded-lg hover:bg-gray-50 active:bg-gray-100 transition-colors flex flex-col items-center justify-center gap-1"
              >
                <span className="text-lg">{provider.symbol}</span>
                <span className="text-xs text-gray-700 font-medium">{provider.name}</span>
              </button>
            ))}
          </div>

          {/* Sign up link */}
          <div className="text-center mt-8">
            <p className="text-gray-600 text-sm">
              ¿No tienes una cuenta?{' '}
              <Link href="/register" className="text-blue-600 hover:text-blue-700 font-semibold">
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
