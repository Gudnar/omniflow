'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { ShoppingCart, X, MapPin, ArrowLeft, Plus, Minus, Check, Loader2, Search, Menu, ArrowRight, ChevronRight, CalendarDays, Download } from 'lucide-react';
import { apiGet, apiPost, apiPatch, apiDelete } from '@/lib/api-client';
import { useToast } from '@/lib/toast-context';
import type { EcommerceStore, StorefrontProduct, StorefrontProductDetail, StorefrontSession, FulfillmentType, Order, PaymentMethod } from '@/lib/types';
import { waMeLink, tint } from './shared';
import { StorefrontInfoSheet } from './info-sheet';
import { WebchatWidget } from '@/components/webchat/webchat-widget';

type View = 'home' | 'product' | 'checkout' | 'success';

const FULFILLMENT_LABELS: Record<FulfillmentType, string> = {
  PICKUP: 'Retiro en sucursal',
  LOCAL_DELIVERY: 'Entrega a domicilio',
  SHIPPING: 'Envío',
};

export default function StorefrontPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const toast = useToast();
  const slug = params.slug as string;
  const token = searchParams.get('s') ?? '';

  const [store, setStore] = useState<EcommerceStore | null>(null);
  const [products, setProducts] = useState<StorefrontProduct[] | null>(null);
  const [session, setSession] = useState<StorefrontSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [view, setView] = useState<View>('home');
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [productDetail, setProductDetail] = useState<StorefrontProductDetail | null>(null);
  const [showCart, setShowCart] = useState(false);
  const [busy, setBusy] = useState(false);
  const [completedOrder, setCompletedOrder] = useState<Order | null>(null);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);

  const [selectedCategory, setSelectedCategory] = useState('Todos');
  const [search, setSearch] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [bannerIndex, setBannerIndex] = useState(0);

  const [fulfillmentType, setFulfillmentType] = useState<FulfillmentType>('PICKUP');
  const [addressForm, setAddressForm] = useState<{
    label: string;
    recipientName: string;
    phone: string;
    addressLine: string;
    city: string;
    notes: string;
    latitude?: number;
    longitude?: number;
  }>({
    label: 'Casa',
    recipientName: '',
    phone: '',
    addressLine: '',
    city: '',
    notes: '',
  });
  const [locating, setLocating] = useState(false);
  const [locationSaved, setLocationSaved] = useState(false);

  const refetchSession = () =>
    token ? apiGet<StorefrontSession>(`/storefront/sessions/${token}`).then(setSession) : Promise.resolve();

  useEffect(() => {
    // No token: not a broken link, just a visitor arriving without a cart
    // session (e.g. from the public Página de Enlaces) — GET /storefront/:slug
    // and its /products are already public, so we can show the catalog in a
    // read-only "browse" mode instead of hard-blocking the whole page. A
    // token that IS present but invalid/expired still falls through to the
    // catch below and shows the real error, since that was a genuine attempt
    // to resume a purchase.
    const requests: [Promise<EcommerceStore>, Promise<StorefrontProduct[]>, Promise<StorefrontSession | null>] = [
      apiGet<EcommerceStore>(`/storefront/${slug}`),
      apiGet<StorefrontProduct[]>(`/storefront/${slug}/products`),
      token ? apiGet<StorefrontSession>(`/storefront/sessions/${token}`) : Promise.resolve(null),
    ];
    Promise.all(requests)
      .then(([s, p, sess]) => {
        // This tenant sells only via reservations — the ecommerce page has
        // nothing to show; hand off to the booking storefront instead.
        if (s.operationMode === 'BOOKING') {
          router.replace(token ? `/tienda/${slug}/reservas?s=${token}` : `/tienda/${slug}/reservas`);
          return;
        }
        setStore(s);
        setProducts(p);
        setSession(sess);

        // Best-effort, after the page is already showing the default-branch
        // catalog — never blocks the initial render, never prompted for a
        // visitor (no session) or a store with nothing to choose between.
        // Also skipped once a cart already exists: Cart.branchId is fixed at
        // creation and never resynced, so silently swapping branches under
        // an in-progress purchase would disagree with the stock/pricing the
        // customer already committed to.
        if (sess && !sess.cart && s.locatableBranchCount >= 2 && navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              apiPost<StorefrontSession>(`/storefront/sessions/${token}/nearest-branch`, undefined, {
                latitude: pos.coords.latitude,
                longitude: pos.coords.longitude,
              })
                .then((updated) => {
                  setSession(updated);
                  if (updated.branchId && updated.branchId !== sess.branchId) {
                    apiGet<StorefrontProduct[]>(`/storefront/${slug}/products?branchId=${updated.branchId}`).then(setProducts);
                  }
                })
                .catch(() => {});
            },
            () => {},
            { timeout: 8000 },
          );
        }
      })
      .catch((err: any) => setLoadError(err.message ?? 'No se pudo cargar la tienda'))
      .finally(() => setLoading(false));
  }, [slug, token]);

  // Auto-advance the hero when the store has more than one BANNER section.
  const bannerCount = (store?.sections ?? []).filter((s) => s.enabled && s.type === 'BANNER').length;
  useEffect(() => {
    if (bannerCount < 2) return;
    const timer = setInterval(() => setBannerIndex((i) => (i + 1) % bannerCount), 5000);
    return () => clearInterval(timer);
  }, [bannerCount]);

  const openProduct = async (productId: string) => {
    setSelectedProductId(productId);
    setView('product');
    setProductDetail(null);
    try {
      const detail = await apiGet<StorefrontProductDetail>(`/storefront/${slug}/products/${productId}`);
      setProductDetail(detail);
    } catch (err: any) {
      toast.error(err.message ?? 'Error al cargar el producto');
    }
  };

  const addToCart = async (variantId: string, quantity: number) => {
    setBusy(true);
    try {
      await apiPost(`/storefront/sessions/${token}/cart/items`, undefined, { variantId, quantity });
      await refetchSession();
      setShowCart(true);
      setView('home');
    } catch (err: any) {
      toast.error(err.message ?? 'Error al agregar el producto');
    } finally {
      setBusy(false);
    }
  };

  // Quick one-tap add straight from the catalog row — no navigation, no
  // cart drawer popping open, since each row is already a specific
  // purchasable variant (listProducts is one row per branch-product).
  const quickAdd = async (variantId: string) => {
    setBusy(true);
    try {
      await apiPost(`/storefront/sessions/${token}/cart/items`, undefined, { variantId, quantity: 1 });
      await refetchSession();
    } catch (err: any) {
      toast.error(err.message ?? 'Error al agregar el producto');
    } finally {
      setBusy(false);
    }
  };

  const updateQty = async (itemId: string, quantity: number) => {
    setBusy(true);
    try {
      await apiPatch(`/storefront/sessions/${token}/cart/items/${itemId}`, undefined, { quantity });
      await refetchSession();
    } catch (err: any) {
      toast.error(err.message ?? 'Error al actualizar la cantidad');
    } finally {
      setBusy(false);
    }
  };

  const removeItem = async (itemId: string) => {
    setBusy(true);
    try {
      await apiDelete(`/storefront/sessions/${token}/cart/items/${itemId}`);
      await refetchSession();
    } catch (err: any) {
      toast.error(err.message ?? 'Error al quitar el producto');
    } finally {
      setBusy(false);
    }
  };

  const useMyLocation = () => {
    if (!navigator.geolocation) {
      toast.error('Tu navegador no soporta geolocalización.');
      return;
    }
    // The Geolocation API silently refuses to even prompt outside a secure
    // context (HTTPS or localhost) — without this check the button looked
    // like it "did nothing": no permission dialog ever appeared, and there
    // was no error branch to surface that.
    if (!window.isSecureContext) {
      toast.error('El navegador bloquea la ubicación en este sitio porque no es HTTPS ni localhost.');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          // Two places this goes: (1) CommerceSession.metadata, so a
          // PICKUP→delivery switch mid-session or an abandoned checkout
          // still has it available (Order.customerLocation); (2) the address
          // form itself (below), so confirmOrder()'s POST to
          // /storefront/sessions/:token/addresses carries real coordinates
          // on the saved CustomerAddress — CreateAddressDto already accepts
          // latitude/longitude, no reverse-geocoding needed to make this a
          // real, selectable location rather than a side GPS pin.
          await apiPost(`/storefront/sessions/${token}/location`, undefined, {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
          });
          setAddressForm((prev) => ({
            ...prev,
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            // Only fills a blank address line — never overwrites text the
            // customer already typed, so GPS and "otra dirección" can be
            // combined (confirm the pin, then add a reference note).
            addressLine: prev.addressLine || 'Ubicación compartida por GPS',
          }));
          setLocationSaved(true);
          toast.success('Ubicación confirmada. Revisa el mapa abajo y completa los datos para el repartidor.');
        } catch (err: any) {
          toast.error(err.message ?? 'No se pudo guardar tu ubicación.');
        } finally {
          setLocating(false);
        }
      },
      (err) => {
        setLocating(false);
        const messages: Record<number, string> = {
          1: 'Denegaste el permiso de ubicación. Habilítalo para este sitio en la configuración del navegador.',
          2: 'No se pudo determinar tu ubicación actual.',
          3: 'Se agotó el tiempo de espera al obtener tu ubicación.',
        };
        toast.error(messages[err.code] ?? 'No se pudo obtener tu ubicación.');
      },
      { timeout: 10000 },
    );
  };

  const confirmOrder = async () => {
    if (fulfillmentType !== 'PICKUP' && (!addressForm.recipientName || !addressForm.addressLine || !addressForm.phone)) {
      toast.error('Completa la dirección de entrega');
      return;
    }
    setBusy(true);
    try {
      let addressId: string | undefined;
      if (fulfillmentType !== 'PICKUP') {
        const address = await apiPost<{ id: string }>(`/storefront/sessions/${token}/addresses`, undefined, addressForm);
        addressId = address.id;
      }
      const order = await apiPost<Order>(`/storefront/sessions/${token}/checkout`, undefined, {
        fulfillmentType,
        addressId,
      });
      setCompletedOrder(order);
      setView('success');
      apiGet<PaymentMethod[]>(`/storefront/${slug}/payment-methods`).then(setPaymentMethods).catch(() => {});
    } catch (err: any) {
      toast.error(err.message ?? 'No se pudo confirmar el pedido');
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (loadError || !store) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-6 text-center">
        <p className="text-gray-500 text-sm">{loadError ?? 'Tienda no encontrada.'}</p>
      </div>
    );
  }

  const settings = store.settings;
  const cart = session?.cart ?? null;
  const itemCount = cart?.items.reduce((sum, i) => sum + i.quantity, 0) ?? 0;
  const bookingEnabled = store.operationMode === 'BOTH';
  // No session token — a visitor browsing the catalog (e.g. from the public
  // Página de Enlaces), not someone mid-purchase. They can look, not buy:
  // every cart/checkout action is replaced by a WhatsApp hand-off instead.
  const isVisitor = !token;
  const whatsappCatalogLink = store.whatsappPhone ? waMeLink(store.whatsappPhone, 'Hola, quiero hacer un pedido') : null;

  const categories = [
    'Todos',
    ...Array.from(new Set((products ?? []).map((p) => p.product.category?.name).filter(Boolean) as string[])),
  ];
  const filteredProducts = (products ?? []).filter((p) => {
    const matchesCategory = selectedCategory === 'Todos' || p.product.category?.name === selectedCategory;
    const matchesSearch = search.trim() === '' || p.product.name.toLowerCase().includes(search.trim().toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const showFloatingCart = itemCount > 0 && (view === 'home' || view === 'product');

  const bannerSections = store.sections
    .filter((s) => s.enabled && s.type === 'BANNER')
    .sort((a, b) => a.sortOrder - b.sortOrder);
  const activeBanner = bannerSections[bannerIndex % Math.max(bannerSections.length, 1)] ?? null;
  const bannerImageUrl = (activeBanner?.config?.imageUrl as string) || null;

  const scrollToCatalog = () => document.getElementById('storefront-catalog')?.scrollIntoView({ behavior: 'smooth' });

  return (
    <div
      style={{ backgroundColor: settings.backgroundColor, color: settings.textColor }}
      className="min-h-screen pb-24"
    >
      {view === 'home' && (
        <main className="max-w-2xl mx-auto px-4 sm:px-6 pt-4 pb-6">
          {/* Topbar */}
          <div className="flex items-center justify-between mb-4 gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <button onClick={() => setShowInfo(true)} className="p-1.5 -ml-1.5 text-gray-500 flex-shrink-0">
                <Menu className="w-5 h-5" />
              </button>
              {settings.logo ? (
                <img src={settings.logo} alt={store.name} className="w-9 h-9 rounded-xl object-cover flex-shrink-0" />
              ) : (
                <div
                  className="w-9 h-9 rounded-xl flex-shrink-0 flex items-center justify-center text-white font-extrabold text-sm"
                  style={{ backgroundColor: settings.primaryColor }}
                >
                  {store.name.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="min-w-0">
                <span className="font-extrabold text-base truncate block">{store.name}</span>
                {session?.branch && (
                  <span className="text-[11px] text-gray-400 flex items-center gap-0.5 truncate">
                    <MapPin className="w-3 h-3 shrink-0" /> {session.branch.name}
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              <button onClick={() => setShowSearch((s) => !s)} className="p-2 text-gray-500">
                <Search className="w-5 h-5" />
              </button>
              {!isVisitor && (
                <button onClick={() => setShowCart(true)} className="relative p-2 text-gray-500">
                  <ShoppingCart className="w-5 h-5" />
                  {itemCount > 0 && (
                    <span
                      className="absolute top-0.5 right-0.5 text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center text-white"
                      style={{ backgroundColor: settings.promoColor }}
                    >
                      {itemCount}
                    </span>
                  )}
                </button>
              )}
            </div>
          </div>

          {isVisitor && whatsappCatalogLink && (
            <a
              href={whatsappCatalogLink}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-between w-full mb-4 px-4 py-3 rounded-xl text-white"
              style={{ backgroundColor: '#25D366' }}
            >
              <span className="text-sm font-bold">Estás viendo nuestro catálogo. Para comprar, escríbenos por WhatsApp</span>
              <ArrowRight className="w-4 h-4 flex-shrink-0 ml-2" />
            </a>
          )}

          {bookingEnabled && (
            <button
              onClick={() => router.push(isVisitor ? `/tienda/${slug}/reservas` : `/tienda/${slug}/reservas?s=${token}`)}
              className="flex items-center justify-between w-full mb-4 px-4 py-3 rounded-xl border"
              style={{ borderColor: tint(settings.buttonColor, 30), backgroundColor: tint(settings.buttonColor, 8) }}
            >
              <span className="flex items-center gap-2 text-sm font-bold" style={{ color: settings.buttonColor }}>
                <CalendarDays className="w-4 h-4" /> ¿Buscas reservar una cita?
              </span>
              <ArrowRight className="w-4 h-4" style={{ color: settings.buttonColor }} />
            </button>
          )}

          {showSearch && (
            <div className="relative mb-4">
              <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar productos..."
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm bg-white"
              />
            </div>
          )}

          {/* Cover photo — always shown when configured (Apariencia → Imagen
              de portada), independent of the BANNER carousel below. Full
              width, natural height (no crop): merchants often upload a
              ready-made banner graphic with its own text/logo baked in,
              which object-cover would slice off. */}
          {settings.heroImage && (
            <div className="rounded-2xl overflow-hidden mb-5">
              <img src={settings.heroImage} alt="" className="w-full h-auto block" />
            </div>
          )}

          {/* Promo carousel, from the store's own configured BANNER sections */}
          {activeBanner && (
            <div className="relative rounded-2xl overflow-hidden mb-5" style={{ backgroundColor: settings.primaryColor }}>
              <div className="flex items-center justify-between gap-4 p-5 sm:p-6">
                <div className="flex-1 min-w-0 text-white">
                  <h2 className="text-xl sm:text-2xl font-extrabold leading-snug mb-1.5">{activeBanner.title}</h2>
                  {activeBanner.subtitle && <p className="text-sm opacity-90 mb-4">{activeBanner.subtitle}</p>}
                  <button
                    onClick={scrollToCatalog}
                    className="inline-flex items-center gap-1.5 bg-white px-4 py-2 rounded-full text-sm font-extrabold"
                    style={{ color: settings.primaryColor }}
                  >
                    Ver productos <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
                {bannerImageUrl && (
                  <img src={bannerImageUrl} alt="" className="w-28 h-28 sm:w-36 sm:h-36 object-contain flex-shrink-0" />
                )}
              </div>
              {bannerSections.length > 1 && (
                <div className="flex justify-center gap-1.5 pb-3">
                  {bannerSections.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setBannerIndex(i)}
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ backgroundColor: i === bannerIndex % bannerSections.length ? '#fff' : 'rgba(255,255,255,0.4)' }}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {categories.length > 1 && (
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-extrabold text-base">Categorías</h3>
              <button
                onClick={() => setSelectedCategory('Todos')}
                className="text-xs font-bold flex items-center gap-0.5"
                style={{ color: settings.buttonColor }}
              >
                Ver todas <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {categories.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 mb-4">
              {categories.map((c) => (
                <button
                  key={c}
                  onClick={() => setSelectedCategory(c)}
                  className="flex-shrink-0 px-3.5 py-1.5 rounded-full text-xs font-bold transition"
                  style={
                    selectedCategory === c
                      ? { backgroundColor: settings.buttonColor, color: '#fff' }
                      : { backgroundColor: tint(settings.buttonColor, 12), color: settings.buttonColor }
                  }
                >
                  {c}
                </button>
              ))}
            </div>
          )}

          <div id="storefront-catalog" className="space-y-3 scroll-mt-4">
            {filteredProducts.map((p) => (
              <div key={p.id} className="flex items-center gap-3 bg-white rounded-2xl border border-gray-100 shadow-sm p-3">
                <button onClick={() => openProduct(p.product.id)} className="flex-1 min-w-0 flex items-center gap-3 text-left">
                  <div
                    className="w-20 h-20 rounded-xl flex-shrink-0 flex items-center justify-center text-[10px] text-gray-400 overflow-hidden"
                    style={{ backgroundColor: tint(settings.buttonColor, 12) }}
                  >
                    Sin imagen
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">{p.product.name}</p>
                    {p.product.description && <p className="text-xs text-gray-400 truncate">{p.product.description}</p>}
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className="font-bold text-sm" style={{ color: settings.buttonColor }}>
                        Bs. {p.price.toFixed(2)}
                      </span>
                      {p.compareAtPrice != null && p.compareAtPrice > p.price && (
                        <>
                          <span className="text-xs text-gray-400 line-through">Bs. {p.compareAtPrice.toFixed(2)}</span>
                          <span
                            className="text-[10px] font-bold px-1.5 py-0.5 rounded-full text-white"
                            style={{ backgroundColor: settings.promoColor }}
                          >
                            Oferta
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </button>
                {!isVisitor && (
                  <button
                    onClick={() => quickAdd(p.variant.id)}
                    disabled={busy}
                    className="flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-white disabled:opacity-50"
                    style={{ backgroundColor: settings.buttonColor }}
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
            {filteredProducts.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-12">Sin productos disponibles.</p>
            )}
          </div>
        </main>
      )}

      {view === 'product' && (
        <ProductView
          detail={productDetail}
          buttonColor={settings.buttonColor}
          busy={busy}
          onBack={() => setView('home')}
          onAdd={addToCart}
          whatsappHref={
            isVisitor && store.whatsappPhone && productDetail
              ? waMeLink(store.whatsappPhone, `Hola, quiero el producto "${productDetail.name}"`)
              : null
          }
        />
      )}

      {view === 'checkout' && (
        <main className="max-w-lg mx-auto px-4 sm:px-8 py-6">
          <button onClick={() => setView('home')} className="flex items-center gap-1 text-sm text-gray-500 mb-4">
            <ArrowLeft className="w-4 h-4" /> Seguir comprando
          </button>
          <h2 className="font-extrabold text-lg mb-4">Confirmar pedido</h2>

          <div className="space-y-2 mb-6">
            <label className="block text-sm font-medium mb-1">¿Cómo quieres recibirlo?</label>
            {store.fulfillmentOptions.map((opt) => (
              <label key={opt} className="flex items-center gap-2 text-sm bg-white border border-gray-200 rounded-2xl p-3.5 cursor-pointer">
                <input type="radio" checked={fulfillmentType === opt} onChange={() => setFulfillmentType(opt)} />
                {FULFILLMENT_LABELS[opt]}
              </label>
            ))}
          </div>

          {fulfillmentType !== 'PICKUP' && (
            <div className="space-y-3 mb-6">
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={useMyLocation}
                  disabled={locating}
                  className={`flex items-center gap-1.5 text-sm px-3.5 py-2 border rounded-xl disabled:opacity-50 ${
                    locationSaved ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-white border-gray-200'
                  }`}
                >
                  {locationSaved ? <Check className="w-4 h-4" /> : <MapPin className="w-4 h-4" />}
                  {locating ? 'Ubicando...' : locationSaved ? 'Ubicación confirmada' : 'Usar mi ubicación actual'}
                </button>
                {locationSaved && addressForm.latitude && addressForm.longitude && (
                  <a
                    href={`https://www.google.com/maps?q=${addressForm.latitude},${addressForm.longitude}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 underline"
                  >
                    Ver en el mapa
                  </a>
                )}
              </div>
              {!locationSaved && (
                <p className="text-xs text-gray-400">
                  O escribe otra dirección de entrega abajo sin usar tu ubicación actual.
                </p>
              )}
              <input
                placeholder="Nombre de quien recibe"
                value={addressForm.recipientName}
                onChange={(e) => setAddressForm({ ...addressForm, recipientName: e.target.value })}
                className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm bg-white"
              />
              <input
                placeholder="Teléfono"
                value={addressForm.phone}
                onChange={(e) => setAddressForm({ ...addressForm, phone: e.target.value })}
                className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm bg-white"
              />
              <input
                placeholder="Dirección"
                value={addressForm.addressLine}
                onChange={(e) => setAddressForm({ ...addressForm, addressLine: e.target.value })}
                className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm bg-white"
              />
              <input
                placeholder="Ciudad (opcional)"
                value={addressForm.city}
                onChange={(e) => setAddressForm({ ...addressForm, city: e.target.value })}
                className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm bg-white"
              />
              <textarea
                placeholder="Notas para la entrega (opcional)"
                value={addressForm.notes}
                onChange={(e) => setAddressForm({ ...addressForm, notes: e.target.value })}
                rows={2}
                className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm bg-white"
              />
            </div>
          )}

          <div className="bg-white border border-gray-100 rounded-2xl p-4 mb-6 text-sm space-y-1 shadow-sm">
            {cart?.items.map((item) => (
              <div key={item.id} className="flex justify-between">
                <span>{item.product.name} x{item.quantity}</span>
                <span>Bs. {item.subtotal.toFixed(2)}</span>
              </div>
            ))}
            <div className="flex justify-between font-bold pt-2 border-t border-gray-100 mt-2">
              <span>Total</span>
              <span>Bs. {(cart?.total ?? 0).toFixed(2)}</span>
            </div>
            <p className="text-xs text-gray-400 pt-1">Pago contra entrega/retiro — sin pago en línea.</p>
          </div>

          <button
            onClick={confirmOrder}
            disabled={busy || !cart?.items.length}
            className="w-full py-3.5 rounded-2xl text-white font-extrabold disabled:opacity-50"
            style={{ backgroundColor: settings.buttonColor }}
          >
            {busy ? 'Confirmando...' : 'Confirmar pedido'}
          </button>
        </main>
      )}

      {view === 'success' && completedOrder && (
        <main className="max-w-md mx-auto px-4 sm:px-8 py-16 text-center">
          <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-4">
            <Check className="w-8 h-8" />
          </div>
          <h2 className="font-extrabold text-xl mb-1">¡Pedido confirmado!</h2>
          <p className="text-sm text-gray-500 mb-6">Número de pedido: {completedOrder.orderNumber}</p>

          {paymentMethods.length > 0 && (
            <div className="space-y-3 mb-6 text-left">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wide text-center">Cómo pagar</p>
              {paymentMethods.map((pm) => (
                <div key={pm.id} className="rounded-2xl border border-gray-200 p-4">
                  <p className="font-bold text-sm mb-2">{pm.label}</p>
                  {pm.type === 'QR' && pm.qrImageUrl ? (
                    <div className="text-center">
                      <img src={pm.qrImageUrl} alt={pm.label} className="w-40 h-40 mx-auto rounded-lg border border-gray-100 object-contain" />
                      <a
                        href={`/api/storefront/${slug}/payment-methods/${pm.id}/download`}
                        className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold border border-gray-300 hover:bg-gray-50"
                      >
                        <Download className="w-4 h-4" /> Descargar QR para pagar
                      </a>
                    </div>
                  ) : (
                    pm.instructions && <p className="text-sm text-gray-600 whitespace-pre-wrap">{pm.instructions}</p>
                  )}
                </div>
              ))}
            </div>
          )}

          {session?.returnConversationUrl ? (
            <a
              href={session.returnConversationUrl}
              className="inline-block w-full py-3.5 rounded-2xl text-white font-extrabold"
              style={{ backgroundColor: '#25D366' }}
            >
              Volver a la conversación
            </a>
          ) : store.whatsappPhone ? (
            <a
              href={waMeLink(store.whatsappPhone, `Ya confirmé mi pedido ${completedOrder.orderNumber}`)}
              className="inline-block w-full py-3.5 rounded-2xl text-white font-extrabold"
              style={{ backgroundColor: '#25D366' }}
            >
              Volver a WhatsApp
            </a>
          ) : (
            <p className="text-xs text-gray-400">Ya puedes cerrar esta ventana y continuar tu conversación por WhatsApp.</p>
          )}
        </main>
      )}

      {/* Floating cart bar */}
      {showFloatingCart && !showCart && (
        <button
          onClick={() => setShowCart(true)}
          className="fixed bottom-4 left-4 right-4 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 sm:w-96 z-20 flex items-center justify-between px-5 py-3.5 rounded-2xl text-white shadow-xl"
          style={{ backgroundColor: settings.buttonColor, boxShadow: '0 12px 28px -8px rgba(0,0,0,0.35)' }}
        >
          <span className="flex items-center gap-2 font-bold text-sm">
            <ShoppingCart className="w-5 h-5" /> {itemCount} {itemCount === 1 ? 'producto' : 'productos'}
          </span>
          <span className="font-extrabold text-sm">Bs. {(cart?.total ?? 0).toFixed(2)} · Ver carrito</span>
        </button>
      )}

      {/* Cart bottom sheet */}
      {showCart && (
        <div className="fixed inset-0 z-30 flex items-end justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowCart(false)} />
          <div className="relative w-full max-w-lg bg-white rounded-t-[20px] max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <h3 className="font-extrabold">Tu carrito</h3>
              <button onClick={() => setShowCart(false)}>
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {(cart?.items ?? []).map((item) => (
                <div key={item.id} className="flex items-center justify-between text-sm border-b border-gray-50 pb-3">
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{item.product.name}</p>
                    <p className="text-xs text-gray-400">Bs. {item.unitPrice.toFixed(2)}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <button onClick={() => updateQty(item.id, item.quantity - 1)} disabled={busy || item.quantity <= 1} className="p-1 border border-gray-200 rounded-lg disabled:opacity-30">
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="text-xs w-4 text-center">{item.quantity}</span>
                      <button onClick={() => updateQty(item.id, item.quantity + 1)} disabled={busy} className="p-1 border border-gray-200 rounded-lg">
                        <Plus className="w-3 h-3" />
                      </button>
                      <button onClick={() => removeItem(item.id)} disabled={busy} className="text-xs text-red-500 ml-2">
                        Quitar
                      </button>
                    </div>
                  </div>
                  <p className="font-semibold text-gray-900">Bs. {item.subtotal.toFixed(2)}</p>
                </div>
              ))}
              {(cart?.items.length ?? 0) === 0 && <p className="text-sm text-gray-400 text-center py-12">Tu carrito está vacío.</p>}
            </div>
            <div className="p-4 border-t border-gray-100 space-y-3">
              <div className="flex justify-between font-bold text-sm">
                <span>Total</span>
                <span>Bs. {(cart?.total ?? 0).toFixed(2)}</span>
              </div>
              <button
                onClick={() => {
                  setShowCart(false);
                  setView('checkout');
                }}
                disabled={!cart?.items.length}
                className="w-full py-3 rounded-2xl text-white font-extrabold disabled:opacity-50"
                style={{ backgroundColor: settings.buttonColor }}
              >
                Ir a confirmar pedido
              </button>
            </div>
          </div>
        </div>
      )}

      <StorefrontInfoSheet show={showInfo} onClose={() => setShowInfo(false)} store={store} token={token} />

      {store.chatEnabled && (
        <WebchatWidget
          startUrl={`/webchat/store/${slug}/start`}
          storageKey={`webchat_store_${slug}`}
          primaryColor={settings.buttonColor}
          title="Asistente de compra"
          placeholder="Preguntame sobre productos, precios o disponibilidad."
        />
      )}
    </div>
  );
}

function ProductView({
  detail,
  buttonColor,
  busy,
  onBack,
  onAdd,
  whatsappHref,
}: {
  detail: StorefrontProductDetail | null;
  buttonColor: string;
  busy: boolean;
  onBack: () => void;
  onAdd: (variantId: string, quantity: number) => void;
  // Non-null only in visitor mode — replaces the whole "add to cart" action
  // with a WhatsApp hand-off pre-filled with this exact product's name.
  whatsappHref: string | null;
}) {
  const [variantId, setVariantId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    if (detail && !variantId) {
      const firstAvailable = detail.variants.find((v) => v.available) ?? detail.variants[0];
      setVariantId(firstAvailable?.id ?? null);
    }
  }, [detail, variantId]);

  if (!detail) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  const selected = detail.variants.find((v) => v.id === variantId);

  return (
    <main className="max-w-lg mx-auto px-4 sm:px-8 py-6">
      <button onClick={onBack} className="flex items-center gap-1 text-sm text-gray-500 mb-4">
        <ArrowLeft className="w-4 h-4" /> Volver al catálogo
      </button>
      <div className="aspect-square rounded-2xl flex items-center justify-center text-gray-300 text-sm mb-4 overflow-hidden" style={{ backgroundColor: tint(buttonColor, 12) }}>
        {detail.media[0]?.url ? <img src={detail.media[0].url} alt={detail.name} className="w-full h-full object-cover" /> : 'Sin imagen'}
      </div>
      <h2 className="font-extrabold text-xl mb-1">{detail.name}</h2>
      {detail.description && <p className="text-sm text-gray-500 mb-4">{detail.description}</p>}

      {detail.variants.length > 1 && (
        <div className="mb-4">
          <label className="block text-sm font-medium mb-1.5">Opción</label>
          <select value={variantId ?? ''} onChange={(e) => setVariantId(e.target.value)} className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm">
            {detail.variants.map((v) => (
              <option key={v.id} value={v.id} disabled={!v.available}>
                {v.name || v.sku} {!v.available ? '(sin stock)' : ''}
              </option>
            ))}
          </select>
        </div>
      )}

      <p className="text-2xl font-extrabold mb-4" style={{ color: buttonColor }}>
        {selected?.price != null ? `Bs. ${selected.price.toFixed(2)}` : 'No disponible'}
      </p>

      {!whatsappHref && (
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => setQuantity((q) => Math.max(1, q - 1))} className="p-2 border border-gray-200 rounded-xl">
            <Minus className="w-4 h-4" />
          </button>
          <span className="w-8 text-center">{quantity}</span>
          <button onClick={() => setQuantity((q) => q + 1)} className="p-2 border border-gray-200 rounded-xl">
            <Plus className="w-4 h-4" />
          </button>
        </div>
      )}

      {whatsappHref ? (
        <a
          href={whatsappHref}
          target="_blank"
          rel="noreferrer"
          className="block w-full text-center py-3.5 rounded-2xl text-white font-extrabold"
          style={{ backgroundColor: '#25D366' }}
        >
          Consultar por WhatsApp
        </a>
      ) : (
        <button
          onClick={() => variantId && onAdd(variantId, quantity)}
          disabled={busy || !selected?.available}
          className="w-full py-3.5 rounded-2xl text-white font-extrabold disabled:opacity-50"
          style={{ backgroundColor: buttonColor }}
        >
          {selected?.available ? 'Agregar al carrito' : 'Sin stock'}
        </button>
      )}
    </main>
  );
}
