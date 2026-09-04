'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@omniflow/ui';
import { useAuth } from '@/lib/auth-context';
import { MessageCircle, Users, TrendingUp } from 'lucide-react';

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
      {/* Left side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-blue-600 via-blue-700 to-blue-900 text-white p-12 flex-col justify-between relative overflow-hidden">
        {/* Decorative waves */}
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-green-400/20 to-transparent" style={{
          clipPath: 'polygon(0 20%, 100% 0, 100% 100%, 0% 100%)'
        }}></div>

        {/* Content */}
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-12">
            <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
              <MessageCircle className="w-6 h-6" />
            </div>
            <h1 className="text-2xl font-bold">OmniFlow</h1>
          </div>

          <div className="mb-16">
            <h2 className="text-4xl font-bold mb-4">
              Conecta, gestiona y<br />
              <span className="text-blue-200">haz crecer tu negocio</span>
            </h2>
            <p className="text-blue-100 text-lg leading-relaxed">
              OmniFlow unifica conversaciones, clientes, ventas y operaciones en una sola plataforma impulsada por IA.
            </p>
          </div>

          {/* Features */}
          <div className="space-y-6">
            <div className="flex gap-4 items-start">
              <div className="w-12 h-12 bg-blue-500 rounded-lg flex items-center justify-center flex-shrink-0">
                <Users className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-lg mb-1">Agentes IA</h3>
                <p className="text-blue-100">Atiende, vende y brinda soporte 24/7 por WhatsApp y otros canales.</p>
              </div>
            </div>

            <div className="flex gap-4 items-start">
              <div className="w-12 h-12 bg-blue-500 rounded-lg flex items-center justify-center flex-shrink-0">
                <MessageCircle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-lg mb-1">Ecommerce conversacional</h3>
                <p className="text-blue-100">Catálogo, carrito y pagos dentro de la conversación.</p>
              </div>
            </div>

            <div className="flex gap-4 items-start">
              <div className="w-12 h-12 bg-blue-500 rounded-lg flex items-center justify-center flex-shrink-0">
                <TrendingUp className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-lg mb-1">Reportes en tiempo real</h3>
                <p className="text-blue-100">Toma decisiones con dashboards e indicadores clave.</p>
              </div>
            </div>
          </div>
        </div>

        {/* User avatars and count */}
        <div className="flex items-center gap-2 relative z-10">
          <div className="flex -space-x-2">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="w-10 h-10 bg-gradient-to-br from-blue-300 to-blue-500 rounded-full border-2 border-blue-600 flex items-center justify-center text-xs font-bold"
              >
                {String.fromCharCode(64 + i)}
              </div>
            ))}
          </div>
          <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-sm font-bold">
            +4995
          </div>
          <p className="text-blue-100 text-sm ml-2">Más de 1.000 empresas ya confían en OmniFlow</p>
        </div>
      </div>

      {/* Right side - Login Form */}
      <div className="w-full lg:w-1/2 flex flex-col justify-center px-6 sm:px-12 py-12">
        <div className="max-w-md mx-auto w-full">
          {/* Language selector */}
          <div className="flex justify-end mb-8">
            <button className="flex items-center gap-2 text-gray-700 hover:text-gray-900 font-medium">
              <span>🌐</span> Español
            </button>
          </div>

          {/* Header */}
          <div className="mb-8">
            <h2 className="text-3xl font-bold text-gray-900 mb-2">Bienvenido de nuevo</h2>
            <p className="text-gray-600">Inicia sesión para continuar en OmniFlow</p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
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
                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                >
                  {showPassword ? '👁️' : '👁️‍🗨️'}
                </button>
              </div>
              <a href="#" className="text-sm text-blue-600 hover:text-blue-700 mt-2 inline-block">¿Olvidaste tu contraseña?</a>
            </div>

            {/* Remember me */}
            <div className="flex items-center">
              <input
                type="checkbox"
                id="remember"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
              />
              <label htmlFor="remember" className="ml-2 text-sm text-gray-700">
                Recuérdame
              </label>
            </div>

            {/* Submit button */}
            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg"
            >
              {loading ? 'Iniciando sesión...' : 'Iniciar sesión'}
            </Button>
          </form>

          {/* OAuth */}
          <div className="mt-8">
            <div className="relative mb-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">o continúa con</span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              {[
                { name: 'Google', icon: '🔍' },
                { name: 'Microsoft', icon: '⊞' },
                { name: 'Apple', icon: '🍎' },
              ].map((provider) => (
                <button
                  key={provider.name}
                  type="button"
                  className="py-3 px-4 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium text-gray-700 flex items-center justify-center gap-2"
                >
                  <span>{provider.icon}</span>
                  <span className="text-xs">{provider.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Sign up link */}
          <div className="text-center mt-8">
            <p className="text-gray-600">
              ¿No tienes una cuenta?{' '}
              <Link href="/register" className="text-blue-600 hover:text-blue-700 font-semibold">
                Solicita una demostración
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
