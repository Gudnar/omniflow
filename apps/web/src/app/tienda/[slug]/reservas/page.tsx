'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, Check, ChevronLeft, ChevronRight, Clock, Loader2, Menu, CalendarDays, ShoppingBag } from 'lucide-react';
import { apiGet, apiPost } from '@/lib/api-client';
import { useToast } from '@/lib/toast-context';
import type { EcommerceStore, StorefrontSession, StorefrontBookingService, AvailabilitySlot, Appointment } from '@/lib/types';
import { waMeLink, tint, earliestBookableDateStr, WEEKDAY_LABELS, MONTH_LABELS } from '../shared';
import { StorefrontInfoSheet } from '../info-sheet';

type View = 'services' | 'calendar' | 'slots' | 'confirm' | 'success';

export default function BookingStorefrontPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const toast = useToast();
  const slug = params.slug as string;
  const token = searchParams.get('s') ?? '';

  const [store, setStore] = useState<EcommerceStore | null>(null);
  const [session, setSession] = useState<StorefrontSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [view, setView] = useState<View>('services');
  const [showInfo, setShowInfo] = useState(false);
  const [busy, setBusy] = useState(false);

  const [services, setServices] = useState<StorefrontBookingService[] | null>(null);
  const [selectedService, setSelectedService] = useState<StorefrontBookingService | null>(null);
  const [bookingConfig, setBookingConfig] = useState<{ minBookingLeadDays: number; dates: string[] } | null>(null);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  });
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [availableSlots, setAvailableSlots] = useState<AvailabilitySlot[] | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<AvailabilitySlot | null>(null);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [completedAppointment, setCompletedAppointment] = useState<Appointment | null>(null);

  useEffect(() => {
    // No token: a visitor browsing services (e.g. from the public Página de
    // Enlaces), not someone mid-booking. GET /storefront/:slug and its
    // /booking/services are already public — show the catalog read-only
    // instead of hard-blocking. A present-but-invalid/expired token still
    // falls through to the catch below with the real error.
    Promise.all([
      apiGet<EcommerceStore>(`/storefront/${slug}`),
      token ? apiGet<StorefrontSession>(`/storefront/sessions/${token}`) : Promise.resolve(null),
    ])
      .then(([s, sess]) => {
        // This tenant doesn't take reservations at all — nothing to show here.
        if (s.operationMode === 'DIRECT_SALE') {
          router.replace(token ? `/tienda/${slug}?s=${token}` : `/tienda/${slug}`);
          return;
        }
        setStore(s);
        setSession(sess);
        apiGet<StorefrontBookingService[]>(`/storefront/${slug}/booking/services`)
          .then(setServices)
          .catch((err) => console.error('Error fetching booking services:', err));
      })
      .catch((err: any) => setLoadError(err.message ?? 'No se pudo cargar la tienda'))
      .finally(() => setLoading(false));
  }, [slug, token]);

  const openService = async (service: StorefrontBookingService) => {
    setSelectedService(service);
    setSelectedDate(null);
    setAvailableSlots(null);
    setSelectedSlot(null);
    setView('calendar');
    if (!bookingConfig) {
      try {
        const config = await apiGet<{ minBookingLeadDays: number; dates: string[] }>(
          `/storefront/sessions/${token}/booking/blackout-dates`,
        );
        setBookingConfig(config);
      } catch (err: any) {
        toast.error(err.message ?? 'No se pudo cargar la disponibilidad');
      }
    }
  };

  const selectCalendarDate = async (dateStr: string) => {
    if (!selectedService) return;
    setSelectedDate(dateStr);
    setAvailableSlots(null);
    setLoadingSlots(true);
    setView('slots');
    try {
      const slots = await apiGet<AvailabilitySlot[]>(
        `/storefront/sessions/${token}/booking/availability?serviceId=${selectedService.id}&date=${dateStr}`,
      );
      setAvailableSlots(slots);
    } catch (err: any) {
      toast.error(err.message ?? 'No se pudo cargar los horarios disponibles');
    } finally {
      setLoadingSlots(false);
    }
  };

  const confirmBooking = async () => {
    if (!selectedService || !selectedSlot) return;
    setBusy(true);
    try {
      const appointment = await apiPost<Appointment>(`/storefront/sessions/${token}/booking/appointments`, undefined, {
        serviceId: selectedService.id,
        startAt: selectedSlot.startAt,
      });
      setCompletedAppointment(appointment);
      setView('success');
    } catch (err: any) {
      toast.error(err.message ?? 'No se pudo confirmar la reserva');
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
  const catalogEnabled = store.operationMode === 'BOTH';
  // No session token — a visitor looking at services (e.g. from the public
  // Página de Enlaces), not someone mid-booking. They can look, not reserve:
  // "Reservar" hands off to WhatsApp instead of opening the calendar.
  const isVisitor = !token;
  const whatsappCatalogLink = store.whatsappPhone ? waMeLink(store.whatsappPhone, 'Hola, quiero reservar una cita') : null;

  return (
    <div style={{ backgroundColor: settings.backgroundColor, color: settings.textColor }} className="min-h-screen pb-24">
      {view === 'services' && (
        <main className="max-w-2xl mx-auto px-4 sm:px-6 pt-4 pb-6">
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
              <span className="font-extrabold text-base truncate">{store.name}</span>
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
              <span className="text-sm font-bold">Estás viendo nuestros servicios. Para reservar, escríbenos por WhatsApp</span>
              <ArrowRight className="w-4 h-4 flex-shrink-0 ml-2" />
            </a>
          )}

          {catalogEnabled && (
            <button
              onClick={() => router.push(isVisitor ? `/tienda/${slug}` : `/tienda/${slug}?s=${token}`)}
              className="flex items-center justify-between w-full mb-4 px-4 py-3 rounded-xl border"
              style={{ borderColor: tint(settings.buttonColor, 30), backgroundColor: tint(settings.buttonColor, 8) }}
            >
              <span className="flex items-center gap-2 text-sm font-bold" style={{ color: settings.buttonColor }}>
                <ShoppingBag className="w-4 h-4" /> Ver catálogo de productos
              </span>
              <ArrowRight className="w-4 h-4" style={{ color: settings.buttonColor }} />
            </button>
          )}

          <h2 className="font-extrabold text-lg mb-3">Reservar una cita</h2>

          <div className="space-y-3">
            {(services ?? []).map((s) => {
              const serviceWhatsappHref = isVisitor && store.whatsappPhone
                ? waMeLink(store.whatsappPhone, `Hola, quiero reservar "${s.name}"`)
                : null;
              return (
                <div key={s.id} className="flex items-center gap-3 bg-white rounded-2xl border border-gray-100 shadow-sm p-3">
                  <button
                    onClick={() => !serviceWhatsappHref && openService(s)}
                    disabled={!!serviceWhatsappHref}
                    className="flex-1 min-w-0 flex items-center gap-3 text-left disabled:cursor-default"
                  >
                    <div
                      className="w-14 h-14 rounded-xl flex-shrink-0 flex items-center justify-center"
                      style={{ backgroundColor: tint(settings.buttonColor, 12), color: settings.buttonColor }}
                    >
                      <CalendarDays className="w-6 h-6" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">{s.name}</p>
                      {s.description && <p className="text-xs text-gray-400 truncate">{s.description}</p>}
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className="font-bold text-sm" style={{ color: settings.buttonColor }}>
                          Bs. {s.price.toFixed(2)}
                        </span>
                        <span className="text-xs text-gray-400">· {s.durationMinutes} min</span>
                      </div>
                    </div>
                  </button>
                  {serviceWhatsappHref ? (
                    <a
                      href={serviceWhatsappHref}
                      target="_blank"
                      rel="noreferrer"
                      className="flex-shrink-0 px-3.5 py-2 rounded-full text-white text-xs font-bold"
                      style={{ backgroundColor: '#25D366' }}
                    >
                      Reservar por WhatsApp
                    </a>
                  ) : (
                    <button
                      onClick={() => openService(s)}
                      className="flex-shrink-0 px-3.5 py-2 rounded-full text-white text-xs font-bold"
                      style={{ backgroundColor: settings.buttonColor }}
                    >
                      Reservar
                    </button>
                  )}
                </div>
              );
            })}
            {services !== null && services.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-12">Sin servicios disponibles.</p>
            )}
            {services === null && (
              <div className="flex justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
              </div>
            )}
          </div>
        </main>
      )}

      {view === 'calendar' && selectedService && (
        <BookingCalendarView
          service={selectedService}
          bookingConfig={bookingConfig}
          calendarMonth={calendarMonth}
          setCalendarMonth={setCalendarMonth}
          onSelectDate={selectCalendarDate}
          buttonColor={settings.buttonColor}
          onBack={() => setView('services')}
        />
      )}

      {view === 'slots' && selectedService && (
        <main className="max-w-lg mx-auto px-4 sm:px-8 py-6">
          <button onClick={() => setView('calendar')} className="flex items-center gap-1 text-sm text-gray-500 mb-4">
            <ArrowLeft className="w-4 h-4" /> Elegir otra fecha
          </button>
          <h2 className="font-extrabold text-lg mb-1">{selectedService.name}</h2>
          <p className="text-sm text-gray-500 mb-4">
            {selectedDate &&
              new Date(`${selectedDate}T00:00:00.000Z`).toLocaleDateString('es-BO', { timeZone: 'UTC', dateStyle: 'full' })}
          </p>

          {loadingSlots && (
            <div className="flex justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            </div>
          )}

          {!loadingSlots && availableSlots && availableSlots.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-12">Sin horarios disponibles ese día. Elige otra fecha.</p>
          )}

          {!loadingSlots && availableSlots && availableSlots.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {availableSlots.map((slot) => (
                <button
                  key={slot.startAt}
                  onClick={() => {
                    setSelectedSlot(slot);
                    setView('confirm');
                  }}
                  className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl border text-sm font-semibold"
                  style={{ borderColor: tint(settings.buttonColor, 30), color: settings.buttonColor }}
                >
                  <Clock className="w-3.5 h-3.5" />
                  {new Date(slot.startAt).toISOString().slice(11, 16)}
                </button>
              ))}
            </div>
          )}
        </main>
      )}

      {view === 'confirm' && selectedService && selectedSlot && (
        <main className="max-w-lg mx-auto px-4 sm:px-8 py-6">
          <button onClick={() => setView('slots')} className="flex items-center gap-1 text-sm text-gray-500 mb-4">
            <ArrowLeft className="w-4 h-4" /> Elegir otro horario
          </button>
          <h2 className="font-extrabold text-lg mb-4">Confirmar reserva</h2>

          <div className="bg-white border border-gray-100 rounded-2xl p-4 mb-6 text-sm space-y-2 shadow-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Servicio</span>
              <span className="font-semibold">{selectedService.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Fecha</span>
              <span className="font-semibold">
                {new Date(selectedSlot.startAt).toLocaleDateString('es-BO', { timeZone: 'UTC', dateStyle: 'long' })}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Hora</span>
              <span className="font-semibold">{new Date(selectedSlot.startAt).toISOString().slice(11, 16)}</span>
            </div>
            <div className="flex justify-between font-bold pt-2 border-t border-gray-100 mt-2">
              <span>Total</span>
              <span>Bs. {selectedService.price.toFixed(2)}</span>
            </div>
          </div>

          <button
            onClick={confirmBooking}
            disabled={busy}
            className="w-full py-3.5 rounded-2xl text-white font-extrabold disabled:opacity-50"
            style={{ backgroundColor: settings.buttonColor }}
          >
            {busy ? 'Confirmando...' : 'Confirmar reserva'}
          </button>
        </main>
      )}

      {view === 'success' && completedAppointment && (
        <main className="max-w-md mx-auto px-4 sm:px-8 py-16 text-center">
          <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-4">
            <Check className="w-8 h-8" />
          </div>
          <h2 className="font-extrabold text-xl mb-1">¡Reserva confirmada!</h2>
          <p className="text-sm text-gray-500 mb-6">
            {new Date(completedAppointment.startAt).toLocaleDateString('es-BO', { timeZone: 'UTC', dateStyle: 'long' })} ·{' '}
            {new Date(completedAppointment.startAt).toISOString().slice(11, 16)}
          </p>
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
              href={waMeLink(store.whatsappPhone, `Ya confirmé mi reserva del ${completedAppointment.startAt}`)}
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

      <StorefrontInfoSheet show={showInfo} onClose={() => setShowInfo(false)} store={store} token={token} />
    </div>
  );
}

function BookingCalendarView({
  service,
  bookingConfig,
  calendarMonth,
  setCalendarMonth,
  onSelectDate,
  buttonColor,
  onBack,
}: {
  service: StorefrontBookingService;
  bookingConfig: { minBookingLeadDays: number; dates: string[] } | null;
  calendarMonth: Date;
  setCalendarMonth: (updater: (d: Date) => Date) => void;
  onSelectDate: (dateStr: string) => void;
  buttonColor: string;
  onBack: () => void;
}) {
  if (!bookingConfig) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  const year = calendarMonth.getUTCFullYear();
  const month = calendarMonth.getUTCMonth();
  const firstWeekday = new Date(Date.UTC(year, month, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const earliestStr = earliestBookableDateStr(bookingConfig.minBookingLeadDays);

  const cells: (number | null)[] = [...Array(firstWeekday).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];

  return (
    <main className="max-w-lg mx-auto px-4 sm:px-8 py-6">
      <button onClick={onBack} className="flex items-center gap-1 text-sm text-gray-500 mb-4">
        <ArrowLeft className="w-4 h-4" /> Volver a servicios
      </button>
      <h2 className="font-extrabold text-lg mb-1">{service.name}</h2>
      <p className="text-sm text-gray-500 mb-4">Elige una fecha ({service.durationMinutes} min · Bs. {service.price.toFixed(2)})</p>

      <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <button onClick={() => setCalendarMonth((d) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 1, 1)))} className="p-1.5 rounded-lg hover:bg-gray-50">
            <ChevronLeft className="w-4 h-4 text-gray-500" />
          </button>
          <p className="font-bold text-sm">
            {MONTH_LABELS[month]} {year}
          </p>
          <button onClick={() => setCalendarMonth((d) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1)))} className="p-1.5 rounded-lg hover:bg-gray-50">
            <ChevronRight className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1 mb-1">
          {WEEKDAY_LABELS.map((d, i) => (
            <div key={i} className="text-center text-[11px] font-semibold text-gray-400 py-1">
              {d}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {cells.map((day, i) => {
            if (day === null) return <div key={`empty-${i}`} />;
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const disabled = dateStr < earliestStr || bookingConfig.dates.includes(dateStr);
            return (
              <button
                key={dateStr}
                disabled={disabled}
                onClick={() => onSelectDate(dateStr)}
                className="aspect-square rounded-lg text-sm font-semibold disabled:text-gray-300 disabled:cursor-not-allowed"
                style={!disabled ? { color: buttonColor } : undefined}
              >
                {day}
              </button>
            );
          })}
        </div>
      </div>
    </main>
  );
}
