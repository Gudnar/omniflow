'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { Eye, EyeOff } from 'lucide-react';
import Image from 'next/image';

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

  const teamMembers = [
    { id: 1, image: '/images/1.png' },
    { id: 2, image: '/images/2.png' },
    { id: 3, image: '/images/3.png' },
    { id: 4, image: '/images/4.png' },
  ];

  return (
    <div className="min-h-screen flex bg-white">
      {/* Left side - Branding (Blue Gradient) */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-b from-blue-700 via-blue-600 to-blue-900 text-white p-8 flex-col relative overflow-hidden">
        {/* Decorative waves at bottom */}
        <svg className="absolute bottom-0 left-0 right-0 w-full h-48" viewBox="0 0 1200 200" preserveAspectRatio="none" style={{ opacity: 0.25 }}>
          <path d="M0,100 Q300,50 600,100 T1200,100 L1200,200 L0,200 Z" fill="#10b981" />
        </svg>
        <svg className="absolute bottom-20 left-0 right-0 w-full h-40" viewBox="0 0 1200 100" preserveAspectRatio="none" style={{ opacity: 0.2 }}>
          <path d="M0,50 Q200,20 400,50 T800,50 T1200,50 L1200,100 L0,100 Z" fill="#06b6d4" />
        </svg>

        {/* Top Logo */}
        <div className="relative z-10 mb-8">
          <div className="flex items-center gap-2 mb-6">
            <svg className="w-10 h-10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              <circle cx="9" cy="10" r="1" fill="currentColor" />
              <circle cx="12" cy="10" r="1" fill="currentColor" />
              <circle cx="15" cy="10" r="1" fill="currentColor" />
            </svg>
            <h1 className="text-2xl font-bold">OmniFlow</h1>
          </div>

          {/* Main Heading */}
          <h2 className="text-4xl font-bold mb-4 leading-tight">
            Conecta, gestiona y<br />
            <span className="text-blue-200">haz crecer tu negocio</span>
          </h2>
          <p className="text-blue-100 text-sm max-w-sm">
            OmniFlow unifica conversaciones, clientes, ventas y operaciones en una sola plataforma impulsada por IA.
          </p>
        </div>

        {/* Dashboard Preview - LARGE */}
        <div className="relative z-10 flex-1 flex items-center justify-center my-8 mx-auto w-full">
          <div className="relative w-full max-w-xs h-80 rounded-3xl overflow-hidden shadow-2xl border-8 border-white/20 bg-gray-900">
            <Image
              src="/images/dashboard.png"
              alt="Dashboard Preview"
              fill
              className="object-cover object-left"
              priority
            />
            <div className="absolute inset-0 bg-gradient-to-r from-blue-900 via-transparent to-transparent opacity-30"></div>
          </div>
        </div>

        {/* Features List - Compact */}
        <div className="relative z-10 space-y-3 mb-8">
          <div className="flex gap-3">
            <div className="w-12 h-12 bg-blue-500 rounded flex items-center justify-center flex-shrink-0">
              <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z" />
              </svg>
            </div>
            <div>
              <h3 className="font-bold text-sm mb-0.5">Agentes IA</h3>
              <p className="text-blue-100 text-xs">Atiende, vende y brinda soporte 24/7 por WhatsApp y otros canales.</p>
            </div>
          </div>

          <div className="flex gap-3">
            <div className="w-12 h-12 bg-blue-500 rounded flex items-center justify-center flex-shrink-0">
              <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor">
                <path d="M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zM1 2v2h2l3.6 7.59-1.35 2.45c-.16.28-.25.61-.25.96 0 1.1.9 2 2 2h12v-2H7.42c-.14 0-.25-.11-.25-.25l.03-.12.9-1.63h7.45c.75 0 1.41-.41 1.75-1.03l3.58-6.49c.08-.14.12-.31.12-.48 0-.55-.45-1-1-1H5.21l-.94-2H1zm16 16c-1.1 0-1.99.9-1.99 2s.89 2 1.99 2 2-.9 2-2-.9-2-2-2z" />
              </svg>
            </div>
            <div>
              <h3 className="font-bold text-sm mb-0.5">Ecommerce conversacional</h3>
              <p className="text-blue-100 text-xs">Catálogo, carrito y pagos dentro de la conversación.</p>
            </div>
          </div>

          <div className="flex gap-3">
            <div className="w-12 h-12 bg-blue-500 rounded flex items-center justify-center flex-shrink-0">
              <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor">
                <path d="M5 9.2h3V19H5zM10.6 5h2.8v14h-2.8zm5.6 8H19v6h-2.8z" />
              </svg>
            </div>
            <div>
              <h3 className="font-bold text-sm mb-0.5">Reportes en tiempo real</h3>
              <p className="text-blue-100 text-xs">Toma decisiones con dashboards e indicadores clave.</p>
            </div>
          </div>
        </div>

        {/* Bottom: User Avatars */}
        <div className="flex items-center gap-2 relative z-10 pb-8">
          <div className="flex -space-x-2">
            {teamMembers.map((member) => (
              <div
                key={member.id}
                className="w-9 h-9 rounded-full border-2 border-blue-700 overflow-hidden relative"
              >
                <Image
                  src={member.image}
                  alt={`Team member ${member.id}`}
                  fill
                  className="object-cover"
                />
              </div>
            ))}
          </div>
          <div className="w-9 h-9 bg-blue-500 rounded-full border-2 border-blue-700 flex items-center justify-center text-xs font-bold text-white">
            +995
          </div>
          <p className="text-blue-100 text-xs">Más de 1.000 empresas ya confían en OmniFlow</p>
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
