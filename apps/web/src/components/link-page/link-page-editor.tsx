'use client';

import { useEffect, useRef, useState } from 'react';
import { Plus, Trash2, ArrowUp, ArrowDown, Copy, ExternalLink, Store, CalendarDays, Download } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/lib/toast-context';
import { apiGet, apiPatch, apiUpload } from '@/lib/api-client';
import type { LinkPage, LinkPageItem, LinkPageStatus, EcommerceStore } from '@/lib/types';
import { ImageUploadField } from '../settings/ecommerce/image-upload-field';
import { LinkPageView } from './link-page-view';

const ICON_OPTIONS: { value: string; label: string }[] = [
  { value: 'link', label: '🔗 Enlace' },
  { value: 'whatsapp', label: '💬 WhatsApp' },
  { value: 'instagram', label: '📸 Instagram' },
  { value: 'facebook', label: '👍 Facebook' },
  { value: 'tiktok', label: '🎵 TikTok' },
  { value: 'store', label: '🛍️ Tienda' },
  { value: 'calendar', label: '📅 Reservas' },
  { value: 'download', label: '⬇️ Descarga' },
];

// Local-only id for new, unsaved rows — React list keys before the backend
// assigns a real one. Never sent to the API: replaceItems() always deletes
// and recreates the whole set, so an item's id is throwaway either way.
let localIdCounter = 0;
const newLocalId = () => `new-${Date.now()}-${localIdCounter++}`;

export function LinkPageEditor() {
  const { tokens } = useAuth();
  const toast = useToast();
  const [page, setPage] = useState<LinkPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    slug: '',
    title: '',
    bio: '',
    avatarUrl: '',
    status: 'DRAFT' as LinkPageStatus,
    primaryColor: '#2563eb',
    backgroundColor: '#ffffff',
    textColor: '#111827',
    chatEnabled: false,
  });
  const [items, setItems] = useState<(LinkPageItem & { localId: string })[]>([]);
  const [uploadingDownload, setUploadingDownload] = useState(false);
  const downloadFileInputRef = useRef<HTMLInputElement>(null);

  const applyPage = (p: LinkPage) => {
    setPage(p);
    setForm({
      slug: p.slug,
      title: p.title,
      bio: p.bio ?? '',
      avatarUrl: p.avatarUrl ?? '',
      status: p.status,
      primaryColor: p.primaryColor,
      backgroundColor: p.backgroundColor,
      textColor: p.textColor,
      chatEnabled: p.chatEnabled,
    });
    setItems(p.items.map((item) => ({ ...item, localId: item.id })));
  };

  useEffect(() => {
    if (!tokens) return;
    apiGet<LinkPage>('/link-page', tokens.accessToken)
      .then(applyPage)
      .catch((err) => console.error('Error fetching link page:', err))
      .finally(() => setLoading(false));
  }, [tokens]);

  const addItem = () => {
    setItems([
      ...items,
      { localId: newLocalId(), id: '', label: '', url: '', icon: 'link', sortOrder: items.length, enabled: true, clickCount: 0 },
    ]);
  };

  // Quick-fill for the two most common destinations: the tenant's own public
  // storefront/booking pages. These are plain links like any other — a
  // visitor without a cart session browses them read-only and gets sent to
  // WhatsApp to actually buy/reserve (see /tienda/[slug]).
  const addStoreLink = async (kind: 'store' | 'booking') => {
    try {
      const store = await apiGet<EcommerceStore>('/ecommerce/store', tokens?.accessToken);
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      const path = kind === 'booking' ? `/tienda/${store.slug}/reservas` : `/tienda/${store.slug}`;
      setItems([
        ...items,
        {
          localId: newLocalId(),
          id: '',
          label: kind === 'booking' ? 'Reservar una cita' : 'Ir a la tienda',
          url: `${origin}${path}`,
          icon: kind === 'booking' ? 'calendar' : 'store',
          sortOrder: items.length,
          enabled: true,
          clickCount: 0,
        },
      ]);
    } catch (err: any) {
      toast.error(err.message ?? 'No se pudo obtener el enlace de la tienda. ¿Ya la configuraste en Ecommerce?');
    }
  };

  const addDownloadItem = async (file: File) => {
    setUploadingDownload(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const result = await apiUpload<{ url: string }>('/link-page/download-file', tokens?.accessToken, formData);
      setItems((prev) => [
        ...prev,
        {
          localId: newLocalId(),
          id: '',
          label: 'Descargar catálogo',
          url: result.url,
          icon: 'download',
          sortOrder: prev.length,
          enabled: true,
          clickCount: 0,
        },
      ]);
    } catch (err: any) {
      toast.error(err.message ?? 'No se pudo subir el archivo');
    } finally {
      setUploadingDownload(false);
      if (downloadFileInputRef.current) downloadFileInputRef.current.value = '';
    }
  };

  const updateItem = (localId: string, patch: Partial<LinkPageItem>) => {
    setItems(items.map((it) => (it.localId === localId ? { ...it, ...patch } : it)));
  };

  const removeItem = (localId: string) => {
    setItems(items.filter((it) => it.localId !== localId));
  };

  const moveItem = (index: number, direction: -1 | 1) => {
    const next = [...items];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setItems(next.map((it, i) => ({ ...it, sortOrder: i })));
  };

  const save = async () => {
    setSaving(true);
    try {
      await apiPatch('/link-page', tokens?.accessToken, {
        slug: form.slug,
        title: form.title,
        bio: form.bio || undefined,
        avatarUrl: form.avatarUrl,
        status: form.status,
        primaryColor: form.primaryColor,
        backgroundColor: form.backgroundColor,
        textColor: form.textColor,
        chatEnabled: form.chatEnabled,
      });
      const updated = await apiPatch<LinkPage>('/link-page/items', tokens?.accessToken, {
        items: items.map((it, i) => ({
          label: it.label,
          url: it.url,
          icon: it.icon ?? undefined,
          sortOrder: i,
          enabled: it.enabled,
        })),
      });
      applyPage(updated);
      toast.success('Cambios guardados correctamente');
    } catch (err: any) {
      toast.error(err.message ?? 'No se pudieron guardar los cambios');
    } finally {
      setSaving(false);
    }
  };

  const publicUrl = typeof window !== 'undefined' ? `${window.location.origin}/enlaces/${form.slug}` : `/enlaces/${form.slug}`;

  const copyLink = () => {
    navigator.clipboard.writeText(publicUrl).then(() => toast.success('Enlace copiado al portapapeles'));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[30vh]">
        <div className="animate-spin w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3 flex-wrap">
        <span
          className={`text-xs font-semibold px-2.5 py-1 rounded-full shrink-0 ${
            form.status === 'PUBLISHED' ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'
          }`}
        >
          {form.status === 'PUBLISHED' ? 'Publicada' : 'Borrador'}
        </span>
        <code className="flex-1 min-w-[200px] text-sm text-gray-600 truncate">{publicUrl}</code>
        <button onClick={copyLink} className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-semibold text-gray-600 hover:bg-gray-50 shrink-0">
          <Copy className="w-3.5 h-3.5" /> Copiar
        </button>
        <a
          href={publicUrl}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-semibold text-gray-600 hover:bg-gray-50 shrink-0"
        >
          <ExternalLink className="w-3.5 h-3.5" /> Ver página
        </a>
        <button
          onClick={() => setForm({ ...form, status: form.status === 'PUBLISHED' ? 'DRAFT' : 'PUBLISHED' })}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold shrink-0 ${
            form.status === 'PUBLISHED' ? 'bg-gray-100 text-gray-600 hover:bg-gray-200' : 'bg-blue-600 text-white hover:bg-blue-700'
          }`}
        >
          {form.status === 'PUBLISHED' ? 'Pasar a borrador' : 'Publicar'}
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-4 items-start">
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
            <h3 className="text-base font-bold text-gray-900">Perfil</h3>
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-1.5">Slug (URL pública)</label>
              <input
                value={form.slug}
                onChange={(e) => setForm({ ...form, slug: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-1.5">Título</label>
              <input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-1.5">Bio</label>
              <textarea
                value={form.bio}
                onChange={(e) => setForm({ ...form, bio: e.target.value })}
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
            <ImageUploadField
              label="Avatar"
              value={form.avatarUrl}
              onChange={(url) => setForm({ ...form, avatarUrl: url })}
              token={tokens?.accessToken}
              endpoint="/link-page/avatar"
            />
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Color de botones</label>
                <input type="color" value={form.primaryColor} onChange={(e) => setForm({ ...form, primaryColor: e.target.value })} className="w-full h-9 border border-gray-200 rounded-lg" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Fondo</label>
                <input type="color" value={form.backgroundColor} onChange={(e) => setForm({ ...form, backgroundColor: e.target.value })} className="w-full h-9 border border-gray-200 rounded-lg" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Texto</label>
                <input type="color" value={form.textColor} onChange={(e) => setForm({ ...form, textColor: e.target.value })} className="w-full h-9 border border-gray-200 rounded-lg" />
              </div>
            </div>

            <label className="flex items-center justify-between gap-3 pt-2 border-t border-gray-100">
              <span>
                <span className="block text-sm font-medium text-gray-900">Habilitar chat con IA</span>
                <span className="block text-xs text-gray-500 mt-0.5">
                  Agrega una burbuja de chat flotante en tu página pública. Recordá activar el canal "Chat web" en al
                  menos un Agente de IA para que conteste.
                </span>
              </span>
              <input
                type="checkbox"
                checked={form.chatEnabled}
                onChange={(e) => setForm({ ...form, chatEnabled: e.target.checked })}
                className="w-4 h-4 accent-blue-600 shrink-0"
              />
            </label>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h3 className="text-base font-bold text-gray-900">Enlaces</h3>
              <div className="flex flex-wrap gap-2">
                <button onClick={() => addStoreLink('store')} className="flex items-center gap-1 px-3 py-2 border border-gray-200 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-50">
                  <Store className="w-3.5 h-3.5" /> Ir a la tienda
                </button>
                <button onClick={() => addStoreLink('booking')} className="flex items-center gap-1 px-3 py-2 border border-gray-200 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-50">
                  <CalendarDays className="w-3.5 h-3.5" /> Reservar cita
                </button>
                <button
                  onClick={() => downloadFileInputRef.current?.click()}
                  disabled={uploadingDownload}
                  className="flex items-center gap-1 px-3 py-2 border border-gray-200 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                >
                  <Download className="w-3.5 h-3.5" /> {uploadingDownload ? 'Subiendo...' : 'Agregar descarga'}
                </button>
                <input
                  ref={downloadFileInputRef}
                  type="file"
                  accept="application/pdf,image/png,image/jpeg,image/webp,image/gif"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && addDownloadItem(e.target.files[0])}
                />
                <button onClick={addItem} className="flex items-center gap-1 px-3 py-2 border border-gray-200 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-50">
                  <Plus className="w-3.5 h-3.5" /> Agregar enlace
                </button>
              </div>
            </div>
            <p className="text-xs text-gray-400 -mt-1">
              Los visitantes pueden ver la tienda y los servicios, pero para comprar o reservar se los redirige a WhatsApp.
            </p>

            {items.length === 0 && <p className="text-sm text-gray-400">Sin enlaces todavía.</p>}

            {items.map((item, index) => (
              <div key={item.localId} className="border border-gray-200 rounded-lg p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <select
                    value={item.icon ?? 'link'}
                    onChange={(e) => updateItem(item.localId, { icon: e.target.value })}
                    className="px-2 py-2 border border-gray-200 rounded-lg text-xs bg-white shrink-0"
                  >
                    {ICON_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                  <input
                    value={item.label}
                    onChange={(e) => updateItem(item.localId, { label: e.target.value })}
                    placeholder="Etiqueta (ej. Escríbenos por WhatsApp)"
                    className="flex-1 min-w-0 px-3 py-2 border border-gray-200 rounded-lg text-sm"
                  />
                  <label className="flex items-center gap-1.5 text-xs text-gray-500 shrink-0">
                    <input
                      type="checkbox"
                      checked={item.enabled}
                      onChange={(e) => updateItem(item.localId, { enabled: e.target.checked })}
                      className="w-3.5 h-3.5 accent-blue-600"
                    />
                    Visible
                  </label>
                  <button onClick={() => moveItem(index, -1)} className="p-1.5 rounded hover:bg-gray-100 text-gray-400 shrink-0">
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => moveItem(index, 1)} className="p-1.5 rounded hover:bg-gray-100 text-gray-400 shrink-0">
                    <ArrowDown className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => removeItem(item.localId)} className="p-1.5 rounded hover:bg-red-50 text-red-500 shrink-0">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                <input
                  value={item.url}
                  onChange={(e) => updateItem(item.localId, { url: e.target.value })}
                  placeholder="https://wa.me/... , https://instagram.com/... , etc."
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                />
                {item.id && (
                  <p className="text-xs text-gray-400">{item.clickCount} clics</p>
                )}
              </div>
            ))}
          </div>

          <div className="flex justify-end">
            <button
              onClick={save}
              disabled={saving}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm font-semibold"
            >
              {saving ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </div>
        </div>

        <div className="sticky top-6">
          <p className="text-xs font-semibold text-gray-500 mb-2 text-center">Vista previa</p>
          <div className="mx-auto w-[280px] h-[560px] rounded-[2rem] border-8 border-gray-900 overflow-hidden shadow-xl">
            <div className="h-full overflow-y-auto">
              <LinkPageView
                page={{
                  title: form.title || 'Tu título',
                  bio: form.bio || null,
                  avatarUrl: form.avatarUrl || null,
                  primaryColor: form.primaryColor,
                  backgroundColor: form.backgroundColor,
                  textColor: form.textColor,
                  items: items.filter((it) => it.enabled).map((it) => ({ id: it.localId, label: it.label || 'Enlace', url: it.url, icon: it.icon })),
                }}
                interactive={false}
                className="h-full"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
