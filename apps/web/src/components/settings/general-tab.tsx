'use client';

import { useEffect, useRef, useState } from 'react';
import { Camera, Store, Loader2 } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/lib/toast-context';
import { apiGet, apiPatch, apiUpload } from '@/lib/api-client';
import type { Tenant } from '@/lib/types';

const TIMEZONES = [
  { value: 'America/La_Paz', label: '(GMT-04:00) La Paz' },
  { value: 'America/Bogota', label: '(GMT-05:00) Bogotá / Lima / Quito' },
  { value: 'America/Mexico_City', label: '(GMT-06:00) Ciudad de México' },
  { value: 'America/Argentina/Buenos_Aires', label: '(GMT-03:00) Buenos Aires' },
  { value: 'UTC', label: 'UTC' },
];
const LANGUAGES = [
  { value: 'es', label: 'Español' },
  { value: 'en', label: 'English' },
];
const CURRENCIES = [
  { value: 'BOB', label: 'BOB - Boliviano (Bs.)' },
  { value: 'USD', label: 'USD - Dólar estadounidense ($)' },
];
const DATE_FORMATS = ['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD'];
const TIME_FORMATS: { value: string; label: string }[] = [
  { value: '24h', label: '24 horas' },
  { value: '12h', label: '12 horas (AM/PM)' },
];
const DECIMAL_SEPARATORS: { value: string; label: string }[] = [
  { value: ',', label: 'Coma (,)' },
  { value: '.', label: 'Punto (.)' },
];
const THOUSANDS_SEPARATORS: { value: string; label: string }[] = [
  { value: '.', label: 'Punto (.)' },
  { value: ',', label: 'Coma (,)' },
];

export function GeneralTab() {
  const { tokens } = useAuth();
  const toast = useToast();
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!tokens) return;
    apiGet<Tenant>('/tenant', tokens.accessToken)
      .then(setTenant)
      .catch((err) => console.error('Error fetching tenant:', err))
      .finally(() => setLoading(false));
  }, [tokens]);

  const update = (field: keyof Tenant, value: string) => {
    setTenant((prev) => (prev ? { ...prev, [field]: value } : prev));
  };

  const saveCompanyInfo = async () => {
    if (!tenant) return;
    try {
      await apiPatch('/tenant', tokens?.accessToken, {
        name: tenant.name,
        taxId: tenant.taxId,
        description: tenant.description,
        timezone: tenant.timezone,
        language: tenant.language,
        currency: tenant.currency,
      });
      toast.success('Cambios guardados correctamente');
    } catch (err: any) {
      toast.error(err.message ?? 'No se pudieron guardar los cambios');
    }
  };

  const saveRegionalSettings = async () => {
    if (!tenant) return;
    try {
      await apiPatch('/tenant', tokens?.accessToken, {
        dateFormat: tenant.dateFormat,
        timeFormat: tenant.timeFormat,
        decimalSeparator: tenant.decimalSeparator,
        thousandsSeparator: tenant.thousandsSeparator,
      });
      toast.success('Cambios guardados correctamente');
    } catch (err: any) {
      toast.error(err.message ?? 'No se pudieron guardar los cambios');
    }
  };

  const handleLogoFile = async (file: File) => {
    setUploadingLogo(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const result = await apiUpload<{ url: string }>('/tenant/logo', tokens?.accessToken, formData);
      update('logo', result.url);
      toast.success('Logo subido correctamente');
    } catch (err: any) {
      toast.error(err.message ?? 'No se pudo subir el logo');
    } finally {
      setUploadingLogo(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  if (loading || !tenant) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="animate-spin w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full" />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
      {/* Left column */}
      <div className="space-y-5">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-base font-bold text-gray-900 mb-4">Información de la empresa</h3>

          <div className="flex gap-5 mb-5">
            <div className="w-24 h-24 rounded-lg border-2 border-dashed border-gray-200 bg-gray-50 flex items-center justify-center relative shrink-0 overflow-hidden">
              {tenant.logo ? (
                <img src={tenant.logo} alt="Logo" className="w-full h-full object-cover" />
              ) : (
                <Store className="w-8 h-8 text-gray-300" />
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleLogoFile(e.target.files[0])}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingLogo}
                className="absolute -bottom-1.5 -right-1.5 w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-white shadow-sm disabled:opacity-50"
              >
                {uploadingLogo ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Camera className="w-3.5 h-3.5" />}
              </button>
            </div>
            <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Nombre de la empresa</label>
                <input
                  value={tenant.name}
                  onChange={(e) => update('name', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">RUC / NIT</label>
                <input
                  value={tenant.taxId ?? ''}
                  onChange={(e) => update('taxId', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Descripción</label>
                <input
                  value={tenant.description ?? ''}
                  onChange={(e) => update('description', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Zona horaria</label>
              <select
                value={tenant.timezone}
                onChange={(e) => update('timezone', e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                {TIMEZONES.map((tz) => (
                  <option key={tz.value} value={tz.value}>
                    {tz.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Idioma</label>
              <select
                value={tenant.language}
                onChange={(e) => update('language', e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                {LANGUAGES.map((l) => (
                  <option key={l.value} value={l.value}>
                    {l.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Moneda</label>
              <select
                value={tenant.currency}
                onChange={(e) => update('currency', e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                {CURRENCIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              onClick={saveCompanyInfo}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-semibold text-white transition"
            >
              Guardar cambios
            </button>
          </div>
        </div>
      </div>

      {/* Right column */}
      <div className="space-y-5">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-base font-bold text-gray-900 mb-4">Configuración regional</h3>

          <div className="grid grid-cols-2 gap-3 mb-5">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Formato de fecha</label>
              <select
                value={tenant.dateFormat}
                onChange={(e) => update('dateFormat', e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                {DATE_FORMATS.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Formato de hora</label>
              <select
                value={tenant.timeFormat}
                onChange={(e) => update('timeFormat', e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                {TIME_FORMATS.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Separador decimal</label>
              <select
                value={tenant.decimalSeparator}
                onChange={(e) => update('decimalSeparator', e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                {DECIMAL_SEPARATORS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Separador de miles</label>
              <select
                value={tenant.thousandsSeparator}
                onChange={(e) => update('thousandsSeparator', e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                {THOUSANDS_SEPARATORS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              onClick={saveRegionalSettings}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-semibold text-white transition"
            >
              Guardar cambios
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
