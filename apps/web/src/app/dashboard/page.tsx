'use client';

import { useAuth } from '@/lib/auth-context';
import { Building2, MessageCircle, TrendingUp } from 'lucide-react';
import Link from 'next/link';

export default function DashboardPage() {
  const { user } = useAuth();

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">¡Bienvenido a OmniFlow!</h1>
        <p className="text-gray-600">Conecta, gestiona y haz crecer tu negocio con IA</p>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-gray-600 font-medium">Sucursales Activas</h3>
            <Building2 className="w-8 h-8 text-blue-600" />
          </div>
          <p className="text-3xl font-bold text-gray-900">0</p>
          <p className="text-sm text-gray-500 mt-2">Comienza creando tu primera sucursal</p>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-gray-600 font-medium">Usuarios</h3>
            <MessageCircle className="w-8 h-8 text-green-600" />
          </div>
          <p className="text-3xl font-bold text-gray-900">1</p>
          <p className="text-sm text-gray-500 mt-2">Invita a tu equipo</p>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-gray-600 font-medium">Estado</h3>
            <TrendingUp className="w-8 h-8 text-purple-600" />
          </div>
          <p className="text-3xl font-bold text-gray-900">✓</p>
          <p className="text-sm text-gray-500 mt-2">Sistema operativo</p>
        </div>
      </div>

      {/* Welcome card */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-lg p-8 text-white mb-8">
        <h2 className="text-2xl font-bold mb-4">Configuración inicial</h2>
        <p className="mb-6 text-blue-100">
          Sigue estos pasos para empezar a usar OmniFlow al máximo potencial:
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white/10 rounded-lg p-4 backdrop-blur-sm">
            <div className="flex items-center justify-center w-8 h-8 bg-white/20 rounded-full mb-3 font-bold">
              1
            </div>
            <h3 className="font-semibold mb-2">Crear Sucursal</h3>
            <p className="text-sm text-blue-100 mb-4">Comienza agregando tu primer sucursal o ubicación</p>
            <Link
              href="/dashboard/branches"
              className="text-sm font-semibold text-white hover:text-blue-100 flex items-center gap-1"
            >
              Ir →
            </Link>
          </div>

          <div className="bg-white/10 rounded-lg p-4 backdrop-blur-sm">
            <div className="flex items-center justify-center w-8 h-8 bg-white/20 rounded-full mb-3 font-bold">
              2
            </div>
            <h3 className="font-semibold mb-2">Invitar Usuarios</h3>
            <p className="text-sm text-blue-100 mb-4">Agrega a tu equipo con los roles apropiados</p>
            <button className="text-sm font-semibold text-white hover:text-blue-100 flex items-center gap-1">
              Próximamente →
            </button>
          </div>

          <div className="bg-white/10 rounded-lg p-4 backdrop-blur-sm">
            <div className="flex items-center justify-center w-8 h-8 bg-white/20 rounded-full mb-3 font-bold">
              3
            </div>
            <h3 className="font-semibold mb-2">Configurar Canales</h3>
            <p className="text-sm text-blue-100 mb-4">Conecta WhatsApp, Instagram y otros canales</p>
            <button className="text-sm font-semibold text-white hover:text-blue-100 flex items-center gap-1">
              Próximamente →
            </button>
          </div>
        </div>
      </div>

      {/* Resources */}
      <div className="bg-white rounded-lg border border-gray-200 p-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Recursos de Ayuda</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <a href="#" className="flex items-center gap-4 p-4 rounded-lg hover:bg-gray-50 transition border border-gray-200">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
              📖
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Documentación</h3>
              <p className="text-sm text-gray-600">Lee la guía completa de OmniFlow</p>
            </div>
          </a>

          <a href="#" className="flex items-center gap-4 p-4 rounded-lg hover:bg-gray-50 transition border border-gray-200">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
              💬
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Soporte</h3>
              <p className="text-sm text-gray-600">Contacta a nuestro equipo de soporte</p>
            </div>
          </a>

          <a href="#" className="flex items-center gap-4 p-4 rounded-lg hover:bg-gray-50 transition border border-gray-200">
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
              🎓
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Tutoriales</h3>
              <p className="text-sm text-gray-600">Aprende con nuestros videos paso a paso</p>
            </div>
          </a>

          <a href="#" className="flex items-center gap-4 p-4 rounded-lg hover:bg-gray-50 transition border border-gray-200">
            <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center flex-shrink-0">
              🚀
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Changelog</h3>
              <p className="text-sm text-gray-600">Mira las últimas actualizaciones</p>
            </div>
          </a>
        </div>
      </div>
    </div>
  );
}
