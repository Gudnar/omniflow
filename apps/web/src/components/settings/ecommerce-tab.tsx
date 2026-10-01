'use client';

import { useEffect, useState } from 'react';
import { Store, Calendar, Repeat, MessageCircle, MapPin, EyeOff, Truck, Package, Plus, Trash2, ArrowUp, ArrowDown, CheckCircle2 } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/lib/toast-context';
import { apiGet, apiPatch, apiPost } from '@/lib/api-client';
import type {
  EcommerceStore,
  EcommerceStoreSettings,
  EcommerceSection,
  EcommerceOperationMode,
  EcommerceLocationSource,
  FulfillmentType,
  EcommerceSectionType,
} from '@/lib/types';
import { operationTypes, deliveryMethods, locationSources } from './mock-data';
import { StorePreview } from './ecommerce/store-preview';
import { ImageUploadField } from './ecommerce/image-upload-field';

interface Branch {
  id: string;
  name: string;
  slug: string;
  status: 'ACTIVE' | 'INACTIVE';
}

const SUB_TABS = ['Mi tienda', 'Apariencia', 'Constructor', 'Ubicación', 'Entrega', 'Sucursales'] as const;
type SubTab = (typeof SUB_TABS)[number];

const OPERATION_ICONS: Record<string, React.ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
  direct: Store,
  booking: Calendar,
  both: Repeat,
};
const OPERATION_MODE_MAP: Record<string, EcommerceOperationMode> = {
  direct: 'DIRECT_SALE',
  booking: 'BOOKING',
  both: 'BOTH',
};
const OPERATION_MODE_REVERSE: Record<EcommerceOperationMode, string> = {
  DIRECT_SALE: 'direct',
  BOOKING: 'booking',
  BOTH: 'both',
};

const DELIVERY_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  pickup: Store,
  delivery: Truck,
  shipping: Package,
};
const DELIVERY_MAP: Record<string, FulfillmentType> = {
  pickup: 'PICKUP',
  delivery: 'LOCAL_DELIVERY',
  shipping: 'SHIPPING',
};
const DELIVERY_REVERSE: Record<FulfillmentType, string> = {
  PICKUP: 'pickup',
  LOCAL_DELIVERY: 'delivery',
  SHIPPING: 'shipping',
};

const LOCATION_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  whatsapp: MessageCircle,
  ecommerce: MapPin,
  both: MapPin,
  none: EyeOff,
};
const LOCATION_MAP: Record<string, EcommerceLocationSource> = {
  whatsapp: 'WHATSAPP',
  ecommerce: 'STOREFRONT',
  both: 'BOTH',
  none: 'NONE',
};
const LOCATION_REVERSE: Record<EcommerceLocationSource, string> = {
  WHATSAPP: 'whatsapp',
  STOREFRONT: 'ecommerce',
  BOTH: 'both',
  NONE: 'none',
};

export function EcommerceTab() {
  const { tokens } = useAuth();
  const [store, setStore] = useState<EcommerceStore | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [subTab, setSubTab] = useState<SubTab>('Mi tienda');
  const [draftSettings, setDraftSettings] = useState<EcommerceStoreSettings | null>(null);
  const [draftSections, setDraftSections] = useState<EcommerceSection[]>([]);

  const refetch = async () => {
    const data = await apiGet<EcommerceStore>('/ecommerce/store', tokens?.accessToken);
    setStore(data);
    setDraftSettings(data.settings);
    setDraftSections(data.sections);
  };

  useEffect(() => {
    if (!tokens) return;
    Promise.all([
      apiGet<EcommerceStore>('/ecommerce/store', tokens.accessToken),
      apiGet<Branch[]>('/branches', tokens.accessToken),
    ])
      .then(([storeData, branchesData]) => {
        setStore(storeData);
        setDraftSettings(storeData.settings);
        setDraftSections(storeData.sections);
        setBranches(branchesData);
      })
      .catch((err) => console.error('Error fetching store:', err))
      .finally(() => setLoading(false));
  }, [tokens]);

  if (loading || !store || !draftSettings) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="animate-spin w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full" />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[1fr_300px] gap-5 items-start">
      <div className="space-y-5">
        <div className="flex items-center gap-2 flex-wrap border-b border-gray-200">
          {SUB_TABS.map((t) => (
            <button
              key={t}
              onClick={() => setSubTab(t)}
              className={`px-3 py-2.5 text-sm font-medium border-b-2 transition ${
                subTab === t ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {subTab === 'Mi tienda' && <MiTiendaTab store={store} tokens={tokens} refetch={refetch} />}
        {subTab === 'Apariencia' && (
          <AparienciaTab
            draftSettings={draftSettings}
            setDraftSettings={setDraftSettings}
            tokens={tokens}
            refetch={refetch}
          />
        )}
        {subTab === 'Constructor' && (
          <ConstructorTab
            draftSections={draftSections}
            setDraftSections={setDraftSections}
            tokens={tokens}
            refetch={refetch}
          />
        )}
        {subTab === 'Ubicación' && <UbicacionTab store={store} tokens={tokens} refetch={refetch} />}
        {subTab === 'Entrega' && <EntregaTab store={store} tokens={tokens} refetch={refetch} />}
        {subTab === 'Sucursales' && (
          <SucursalesTab store={store} branches={branches} tokens={tokens} refetch={refetch} />
        )}
      </div>

      <StorePreview storeName={store.name} settings={draftSettings} sections={draftSections} />
    </div>
  );
}

function SaveButton({ onClick, label = 'Guardar cambios' }: { onClick: () => void; label?: string }) {
  return (
    <div className="flex justify-end">
      <button
        onClick={onClick}
        className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-semibold text-white transition"
      >
        {label}
      </button>
    </div>
  );
}

function MiTiendaTab({ store, tokens, refetch }: { store: EcommerceStore; tokens: any; refetch: () => void }) {
  const [name, setName] = useState(store.name);
  const [slug, setSlug] = useState(store.slug);
  const [operation, setOperation] = useState(OPERATION_MODE_REVERSE[store.operationMode]);
  const [chatEnabled, setChatEnabled] = useState(store.chatEnabled);
  const [publishing, setPublishing] = useState(false);
  const toast = useToast();

  const save = async () => {
    try {
      await apiPatch('/ecommerce/store', tokens?.accessToken, {
        name,
        slug,
        operationMode: OPERATION_MODE_MAP[operation],
        chatEnabled,
      });
      await refetch();
      toast.success('Cambios guardados correctamente');
    } catch (err: any) {
      toast.error(err.message ?? 'No se pudieron guardar los cambios');
    }
  };

  const publish = async () => {
    setPublishing(true);
    try {
      await apiPost('/ecommerce/store/publish', tokens?.accessToken, {});
      await refetch();
      toast.success('Tienda publicada correctamente');
    } catch (err: any) {
      toast.error(err.message ?? 'No se pudo publicar la tienda');
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold text-gray-900">Mi tienda</h3>
          <span
            className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${
              store.status === 'PUBLISHED' ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            {store.status === 'PUBLISHED' ? 'Publicada' : 'Borrador'}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Nombre de la tienda</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Slug</label>
            <input
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="flex items-center justify-between">
          <p className="text-xs text-gray-400">
            {store.publishedAt ? `Publicada el ${new Date(store.publishedAt).toLocaleString()}` : 'Aún no publicada'}
          </p>
          <div className="flex gap-2">
            <button
              onClick={publish}
              disabled={publishing}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Publicar
            </button>
            <SaveButton onClick={save} />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="text-base font-bold text-gray-900 mb-1">Tipo de operación del ecommerce</h3>
        <p className="text-sm text-gray-500 mb-4">Define cómo funcionará tu ecommerce.</p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {operationTypes.map((opt) => {
            const Icon = OPERATION_ICONS[opt.key];
            const isSelected = operation === opt.key;
            return (
              <button
                key={opt.key}
                onClick={() => setOperation(opt.key)}
                className={`p-4 rounded-lg border text-left transition ${
                  isSelected ? 'border-blue-500 ring-1 ring-blue-500' : 'border-gray-200 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${opt.color}1a` }}>
                    <Icon className="w-4 h-4" style={{ color: opt.color }} />
                  </span>
                  <span className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${isSelected ? 'border-blue-600' : 'border-gray-300'}`}>
                    {isSelected && <span className="w-2 h-2 rounded-full bg-blue-600" />}
                  </span>
                </div>
                <p className="text-sm font-semibold text-gray-900">{opt.title}</p>
                <p className="text-xs text-gray-500 mt-0.5">{opt.description}</p>
              </button>
            );
          })}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <label className="flex items-center justify-between gap-3">
          <span>
            <span className="block text-base font-bold text-gray-900">Asistente de compra con IA</span>
            <span className="block text-sm text-gray-500 mt-0.5">
              Agrega una burbuja de chat flotante en tu tienda en línea para que los visitantes pregunten sobre
              productos, precios o disponibilidad. Recordá activar el canal "Chat web" en al menos un Agente de IA
              para que conteste.
            </span>
          </span>
          <input
            type="checkbox"
            checked={chatEnabled}
            onChange={(e) => setChatEnabled(e.target.checked)}
            className="w-4 h-4 accent-blue-600 shrink-0"
          />
        </label>
      </div>
    </div>
  );
}

function AparienciaTab({
  draftSettings,
  setDraftSettings,
  tokens,
  refetch,
}: {
  draftSettings: EcommerceStoreSettings;
  setDraftSettings: (s: EcommerceStoreSettings) => void;
  tokens: any;
  refetch: () => void;
}) {
  const toast = useToast();

  const update = (field: keyof EcommerceStoreSettings, value: string) => {
    setDraftSettings({ ...draftSettings, [field]: value });
  };

  const save = async () => {
    try {
      await apiPatch('/ecommerce/theme', tokens?.accessToken, draftSettings);
      await refetch();
      toast.success('Cambios guardados correctamente');
    } catch (err: any) {
      toast.error(err.message ?? 'No se pudieron guardar los cambios');
    }
  };

  const colorFields: { key: keyof EcommerceStoreSettings; label: string }[] = [
    { key: 'primaryColor', label: 'Color primario' },
    { key: 'secondaryColor', label: 'Color secundario' },
    { key: 'buttonColor', label: 'Color de botones' },
    { key: 'textColor', label: 'Color de texto' },
    { key: 'backgroundColor', label: 'Color de fondo' },
    { key: 'promoColor', label: 'Color de promociones' },
  ];

  const urlFields: { key: keyof EcommerceStoreSettings; label: string }[] = [
    { key: 'logo', label: 'Logo' },
    { key: 'mobileLogo', label: 'Logo móvil' },
    { key: 'favicon', label: 'Favicon' },
    { key: 'heroImage', label: 'Imagen de portada' },
    { key: 'mobileHeroImage', label: 'Imagen de portada móvil' },
  ];

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-6">
      <div>
        <h3 className="text-base font-bold text-gray-900 mb-1">Marca e imágenes</h3>
        <p className="text-sm text-gray-500 mb-4">Sube un archivo o pega la URL de una imagen ya alojada.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {urlFields.map((f) => (
            <ImageUploadField
              key={f.key}
              label={f.label}
              value={draftSettings[f.key] as string | null}
              onChange={(url) => update(f.key, url)}
              token={tokens?.accessToken}
            />
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-base font-bold text-gray-900 mb-4">Colores y tipografía</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
          {colorFields.map((f) => (
            <div key={f.key}>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">{f.label}</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={(draftSettings[f.key] as string) ?? '#000000'}
                  onChange={(e) => update(f.key, e.target.value)}
                  className="w-9 h-9 rounded border border-gray-200 shrink-0"
                />
                <input
                  value={(draftSettings[f.key] as string) ?? ''}
                  onChange={(e) => update(f.key, e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          ))}
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1.5">Fuente</label>
          <select
            value={draftSettings.fontFamily}
            onChange={(e) => update('fontFamily', e.target.value)}
            className="w-full sm:w-64 px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white"
          >
            {['Inter', 'Roboto', 'Poppins', 'Montserrat', 'Lato'].map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </div>
      </div>

      <SaveButton onClick={save} />
    </div>
  );
}

function ConstructorTab({
  draftSections,
  setDraftSections,
  tokens,
  refetch,
}: {
  draftSections: EcommerceSection[];
  setDraftSections: (s: EcommerceSection[]) => void;
  tokens: any;
  refetch: () => void;
}) {
  const toast = useToast();

  const addSection = (type: EcommerceSectionType) => {
    setDraftSections([
      ...draftSections,
      {
        id: `new-${Date.now()}`,
        type,
        title: '',
        subtitle: '',
        config: {},
        sortOrder: draftSections.length,
        enabled: true,
      },
    ]);
  };

  const updateSection = (id: string, patch: Partial<EcommerceSection>) => {
    setDraftSections(draftSections.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  };

  const removeSection = (id: string) => {
    setDraftSections(draftSections.filter((s) => s.id !== id));
  };

  const move = (index: number, direction: -1 | 1) => {
    const next = [...draftSections];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setDraftSections(next.map((s, i) => ({ ...s, sortOrder: i })));
  };

  const save = async () => {
    try {
      await apiPatch('/ecommerce/sections', tokens?.accessToken, {
        sections: draftSections.map((s, i) => ({
          id: s.id.startsWith('new-') ? undefined : s.id,
          type: s.type,
          title: s.title || undefined,
          subtitle: s.subtitle || undefined,
          config: s.config,
          sortOrder: i,
          enabled: s.enabled,
        })),
      });
      await refetch();
      toast.success('Cambios guardados correctamente');
    } catch (err: any) {
      toast.error(err.message ?? 'No se pudieron guardar los cambios');
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-gray-900">Constructor de secciones</h3>
          <p className="text-sm text-gray-500 mt-0.5">
            Agrega, ordena y edita el contenido de tu portada. Si dejas <strong>2 o más Banner</strong> visibles, se
            muestran en tu tienda como un carrusel con paginación automática — no es una sección aparte, es lo que
            ves al agregar varios Banner.
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => addSection('BANNER')} className="flex items-center gap-1 px-3 py-2 border border-gray-200 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-50">
            <Plus className="w-3.5 h-3.5" /> Banner
          </button>
          <button onClick={() => addSection('TEXT_BLOCK')} className="flex items-center gap-1 px-3 py-2 border border-gray-200 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-50">
            <Plus className="w-3.5 h-3.5" /> Texto
          </button>
          <button onClick={() => addSection('IMAGE_GALLERY')} className="flex items-center gap-1 px-3 py-2 border border-gray-200 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-50">
            <Plus className="w-3.5 h-3.5" /> Galería
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {draftSections.length === 0 && <p className="text-sm text-gray-400">Sin secciones. Agrega una arriba.</p>}
        {draftSections.map((section, index) => (
          <div key={section.id} className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">
                {section.type === 'BANNER' ? 'Banner' : section.type === 'TEXT_BLOCK' ? 'Texto' : 'Galería'}
              </span>
              <div className="flex items-center gap-1">
                <label className="flex items-center gap-1.5 text-xs text-gray-500 mr-2">
                  <input
                    type="checkbox"
                    checked={section.enabled}
                    onChange={(e) => updateSection(section.id, { enabled: e.target.checked })}
                    className="w-3.5 h-3.5 accent-blue-600"
                  />
                  Visible
                </label>
                <button onClick={() => move(index, -1)} className="p-1.5 rounded hover:bg-gray-100 text-gray-400">
                  <ArrowUp className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => move(index, 1)} className="p-1.5 rounded hover:bg-gray-100 text-gray-400">
                  <ArrowDown className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => removeSection(section.id)} className="p-1.5 rounded hover:bg-red-50 text-red-500">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <input
              value={section.title ?? ''}
              onChange={(e) => updateSection(section.id, { title: e.target.value })}
              placeholder="Título"
              className="w-full mb-2 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />

            {section.type === 'TEXT_BLOCK' ? (
              <textarea
                value={section.subtitle ?? ''}
                onChange={(e) => updateSection(section.id, { subtitle: e.target.value })}
                placeholder="Contenido del bloque de texto"
                rows={3}
                className="w-full mb-2 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            ) : (
              <input
                value={section.subtitle ?? ''}
                onChange={(e) => updateSection(section.id, { subtitle: e.target.value })}
                placeholder="Subtítulo"
                className="w-full mb-2 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            )}

            {section.type === 'BANNER' && (
              <ImageUploadField
                label="Imagen del banner"
                value={(section.config?.imageUrl as string) ?? ''}
                onChange={(url) => updateSection(section.id, { config: { ...section.config, imageUrl: url } })}
                token={tokens?.accessToken}
              />
            )}

            {section.type === 'IMAGE_GALLERY' && (
              <input
                value={((section.config?.imageUrls as string[]) ?? []).join(', ')}
                onChange={(e) =>
                  updateSection(section.id, {
                    config: { ...section.config, imageUrls: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) },
                  })
                }
                placeholder="URLs de imágenes separadas por coma"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            )}
          </div>
        ))}
      </div>

      <SaveButton onClick={save} />
    </div>
  );
}

function UbicacionTab({ store, tokens, refetch }: { store: EcommerceStore; tokens: any; refetch: () => void }) {
  const [locationSource, setLocationSource] = useState(LOCATION_REVERSE[store.locationSource]);
  const toast = useToast();

  const save = async () => {
    try {
      await apiPatch('/ecommerce/location', tokens?.accessToken, { locationSource: LOCATION_MAP[locationSource] });
      await refetch();
      toast.success('Cambios guardados correctamente');
    } catch (err: any) {
      toast.error(err.message ?? 'No se pudieron guardar los cambios');
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <h3 className="text-base font-bold text-gray-900 mb-1">Fuente de ubicación del cliente</h3>
      <p className="text-sm text-gray-500 mb-4">Selecciona cómo obtendremos la ubicación para entregas y servicios.</p>

      <div className="space-y-2.5 mb-5">
        {locationSources.map((opt) => {
          const Icon = LOCATION_ICONS[opt.key];
          const isSelected = locationSource === opt.key;
          return (
            <button
              key={opt.key}
              onClick={() => setLocationSource(opt.key)}
              className={`w-full flex items-center gap-3 p-3.5 rounded-lg border text-left transition ${
                isSelected ? 'border-blue-500 bg-blue-50/50' : 'border-gray-200 hover:bg-gray-50'
              }`}
            >
              <span className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${isSelected ? 'border-blue-600' : 'border-gray-300'}`}>
                {isSelected && <span className="w-2 h-2 rounded-full bg-blue-600" />}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900">{opt.title}</p>
                <p className="text-xs text-gray-500">{opt.description}</p>
              </div>
              <span className="w-7 h-7 rounded-full bg-gray-50 flex items-center justify-center shrink-0">
                <Icon className="w-3.5 h-3.5 text-gray-500" />
              </span>
            </button>
          );
        })}
      </div>

      <SaveButton onClick={save} />
    </div>
  );
}

function EntregaTab({ store, tokens, refetch }: { store: EcommerceStore; tokens: any; refetch: () => void }) {
  const [selected, setSelected] = useState<Record<string, boolean>>(
    Object.fromEntries(deliveryMethods.map((d) => [d.key, store.fulfillmentOptions.includes(DELIVERY_MAP[d.key])])),
  );
  const toast = useToast();

  const save = async () => {
    try {
      const fulfillmentOptions = Object.entries(selected)
        .filter(([, checked]) => checked)
        .map(([key]) => DELIVERY_MAP[key]);
      await apiPatch('/ecommerce/fulfillment', tokens?.accessToken, { fulfillmentOptions });
      await refetch();
      toast.success('Cambios guardados correctamente');
    } catch (err: any) {
      toast.error(err.message ?? 'No se pudieron guardar los cambios');
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <h3 className="text-base font-bold text-gray-900 mb-1">Métodos de entrega disponibles</h3>
      <p className="text-sm text-gray-500 mb-4">Selecciona las formas en que entregarás los pedidos y servicios.</p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
        {deliveryMethods.map((opt) => {
          const Icon = DELIVERY_ICONS[opt.key];
          const isChecked = selected[opt.key];
          return (
            <button
              key={opt.key}
              onClick={() => setSelected((prev) => ({ ...prev, [opt.key]: !prev[opt.key] }))}
              className={`p-4 rounded-lg border text-left transition ${
                isChecked ? 'border-blue-500 ring-1 ring-blue-500' : 'border-gray-200 hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="w-9 h-9 rounded-lg bg-emerald-50 flex items-center justify-center">
                  <Icon className="w-4 h-4 text-emerald-600" />
                </span>
                <input type="checkbox" checked={isChecked} readOnly className="w-4 h-4 rounded border-gray-300 accent-blue-600 pointer-events-none" />
              </div>
              <p className="text-sm font-semibold text-gray-900">{opt.title}</p>
              <p className="text-xs text-gray-500 mt-0.5">{opt.description}</p>
            </button>
          );
        })}
      </div>

      <SaveButton onClick={save} />
    </div>
  );
}

function SucursalesTab({
  store,
  branches,
  tokens,
  refetch,
}: {
  store: EcommerceStore;
  branches: Branch[];
  tokens: any;
  refetch: () => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set(store.branchIds));
  const toast = useToast();

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const save = async () => {
    try {
      await apiPatch('/ecommerce/store', tokens?.accessToken, { branchIds: Array.from(selected) });
      await refetch();
      toast.success('Cambios guardados correctamente');
    } catch (err: any) {
      toast.error(err.message ?? 'No se pudieron guardar los cambios');
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <h3 className="text-base font-bold text-gray-900 mb-1">Sucursales habilitadas</h3>
      <p className="text-sm text-gray-500 mb-4">Elige qué sucursales participan en este ecommerce.</p>

      <div className="space-y-2 mb-5">
        {branches.length === 0 && <p className="text-sm text-gray-400">No hay sucursales creadas todavía.</p>}
        {branches.map((b) => (
          <label
            key={b.id}
            className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50"
          >
            <input
              type="checkbox"
              checked={selected.has(b.id)}
              onChange={() => toggle(b.id)}
              className="w-4 h-4 rounded border-gray-300 accent-blue-600"
            />
            <span className="text-sm font-medium text-gray-900">{b.name}</span>
            <span className="text-xs text-gray-400">{b.slug}</span>
          </label>
        ))}
      </div>

      <SaveButton onClick={save} />
    </div>
  );
}
