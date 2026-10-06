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

type BookingConfig = { minBookingLeadDays: number; timezone: string; dates: string[] };

// `slot.startAt`/`appointment.startAt` are real UTC instants — must be
// formatted in the BRANCH's timezone (not the raw UTC digits, and not the
// visitor's own device timezone) to show the time the customer actually
// picked. See appointments.service.ts for the matching backend conversion.
function formatSlotTime(iso: string, timeZone: string): string {
  return new Date(iso).toLocaleTimeString('es-BO', { timeZone, hour: '2-digit', minute: '2-digit', hour12: false });
}

function formatSlotDate(iso: string, timeZone: string, dateStyle: 'long' | 'full' = 'long'): string {
  return new Date(iso).toLocaleDateString('es-BO', { timeZone, dateStyle });
}

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
  const [bookingConfig, setBookingConfig] = useState<BookingConfig | null>(null);
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
        const config = await apiGet<BookingConfig>(`/storefront/sessions/${token}/booking/blackout-dates`);
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
    <div style={{ backgroundColor: '#f7f7f7', color: settings.textColor }} className="min-h-screen pb-24">
      {view === 'services' && (
        <main className="max-w-2xl mx-auto px-4 sm:px-6 pt-5 pb-6">
          <div className="flex items-center justify-between mb-5 gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <button onClick={() => setShowInfo(true)} className="p-2 -ml-2 text-gray-500 flex-shrink-0 rounded-full hover:bg-gray-100">
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
              className="flex items-center justify-between w-full mb-3 px-5 py-3.5 rounded-2xl text-white shadow-sm"
              style={{ backgroundColor: '#25D366' }}
            >
              <span className="text-sm font-bold">Estás viendo nuestros servicios. Para reservar, escríbenos por WhatsApp</span>
              <ArrowRight className="w-4 h-4 flex-shrink-0 ml-2" />
            </a>
          )}

          {catalogEnabled && (
            <button
              onClick={() => router.push(isVisitor ? `/tienda/${slug}` : `/tienda/${slug}?s=${token}`)}
              className="flex items-center justify-between w-full mb-3 px-5 py-3.5 rounded-2xl bg-white shadow-sm"
            >
              <span className="flex items-center gap-2 text-sm font-bold" style={{ color: settings.buttonColor }}>
                <ShoppingBag className="w-4 h-4" /> Ver catálogo de productos
              </span>
              <ArrowRight className="w-4 h-4" style={{ color: settings.buttonColor }} />
            </button>
          )}

          <h2 className="font-extrabold text-2xl mb-4 tracking-tight">Reservar una cita</h2>

          <div className="space-y-3">
            {(services ?? []).map((s) => {
              const serviceWhatsappHref = isVisitor && store.whatsappPhone
                ? waMeLink(store.whatsappPhone, `Hola, quiero reservar "${s.name}"`)
                : null;
              return (
                <div key={s.id} className="bg-white rounded-3xl shadow-sm overflow-hidden">
                  <button
                    onClick={() => !serviceWhatsappHref && openService(s)}
                    disabled={!!serviceWhatsappHref}
                    className="w-full flex items-center gap-4 p-4 text-left disabled:cursor-default"
                  >
                    <div
                      className="w-16 h-16 rounded-2xl flex-shrink-0 flex items-center justify-center"
                      style={{ backgroundColor: tint(settings.buttonColor, 12), color: settings.buttonColor }}
                    >
                      <CalendarDays className="w-7 h-7" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-[15px] truncate">{s.name}</p>
                      {s.description && <p className="text-xs text-gray-400 truncate mt-0.5">{s.description}</p>}
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        <span className="font-extrabold text-base">Bs. {s.price.toFixed(2)}</span>
                        <span className="text-xs font-medium text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{s.durationMinutes} min</span>
                      </div>
                    </div>
                  </button>
                  <div className="px-4 pb-4">
                    {serviceWhatsappHref ? (
                      <a
                        href={serviceWhatsappHref}
                        target="_blank"
                        rel="noreferrer"
                        className="block w-full text-center py-3 rounded-2xl text-white text-sm font-bold"
                        style={{ backgroundColor: '#25D366' }}
                      >
                        Reservar por WhatsApp
                      </a>
                    ) : (
                      <button
                        onClick={() => openService(s)}
                        className="w-full py-3 rounded-2xl text-white text-sm font-bold"
                        style={{ backgroundColor: settings.buttonColor }}
                      >
                        Reservar
                      </button>
                    )}
                  </div>
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
          <button onClick={() => setView('calendar')} className="flex items-center gap-1.5 text-sm font-semibold text-gray-500 mb-5">
            <ArrowLeft className="w-4 h-4" /> Elegir otra fecha
          </button>

          <div className="bg-white rounded-3xl shadow-sm p-5 mb-4">
            <h2 className="font-extrabold text-xl tracking-tight">{selectedService.name}</h2>
            <p className="text-sm text-gray-400 mt-1 capitalize">
              {selectedDate &&
                new Date(`${selectedDate}T00:00:00.000Z`).toLocaleDateString('es-BO', { timeZone: 'UTC', dateStyle: 'full' })}
            </p>
          </div>

          {loadingSlots && (
            <div className="flex justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            </div>
          )}

          {!loadingSlots && availableSlots && availableSlots.length === 0 && (
            <div className="bg-white rounded-3xl shadow-sm py-12 px-6 text-center">
              <p className="text-sm text-gray-400">Sin horarios disponibles ese día. Elige otra fecha.</p>
            </div>
          )}

          {!loadingSlots && availableSlots && availableSlots.length > 0 && (
            <div className="bg-white rounded-3xl shadow-sm p-4">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3 px-1">Horarios disponibles</p>
              <div className="grid grid-cols-3 gap-2.5">
                {availableSlots.map((slot) => (
                  <button
                    key={slot.startAt}
                    onClick={() => {
                      setSelectedSlot(slot);
                      setView('confirm');
                    }}
                    className="flex items-center justify-center gap-1.5 py-3 rounded-2xl border-2 text-sm font-bold transition hover:bg-gray-50"
                    style={{ borderColor: tint(settings.buttonColor, 25), color: settings.buttonColor }}
                  >
                    <Clock className="w-3.5 h-3.5" />
                    {formatSlotTime(slot.startAt, bookingConfig!.timezone)}
                  </button>
                ))}
              </div>
            </div>
          )}
        </main>
      )}

      {view === 'confirm' && selectedService && selectedSlot && (
        <main className="max-w-lg mx-auto px-4 sm:px-8 py-6">
          <button onClick={() => setView('slots')} className="flex items-center gap-1.5 text-sm font-semibold text-gray-500 mb-5">
            <ArrowLeft className="w-4 h-4" /> Elegir otro horario
          </button>
          <h2 className="font-extrabold text-2xl mb-4 tracking-tight">Confirmar reserva</h2>

          <div className="bg-white rounded-3xl shadow-sm p-5 mb-6 divide-y divide-gray-100">
            <div className="flex justify-between items-center pb-3">
              <span className="text-sm text-gray-400">Servicio</span>
              <span className="font-bold text-sm text-right">{selectedService.name}</span>
            </div>
            <div className="flex justify-between items-center py-3">
              <span className="text-sm text-gray-400">Fecha</span>
              <span className="font-bold text-sm text-right">
                {formatSlotDate(selectedSlot.startAt, bookingConfig!.timezone)}
              </span>
            </div>
            <div className="flex justify-between items-center py-3">
              <span className="text-sm text-gray-400">Hora</span>
              <span className="font-bold text-sm">{formatSlotTime(selectedSlot.startAt, bookingConfig!.timezone)}</span>
            </div>
            <div className="flex justify-between items-center pt-3">
              <span className="font-extrabold text-base">Total</span>
              <span className="font-extrabold text-base">Bs. {selectedService.price.toFixed(2)}</span>
            </div>
          </div>

          <button
            onClick={confirmBooking}
            disabled={busy}
            className="w-full py-4 rounded-2xl text-white font-extrabold text-[15px] shadow-sm disabled:opacity-50"
            style={{ backgroundColor: settings.buttonColor }}
          >
            {busy ? 'Confirmando...' : 'Confirmar reserva'}
          </button>
        </main>
      )}

      {view === 'success' && completedAppointment && (
        <main className="max-w-md mx-auto px-4 sm:px-8 py-16 text-center">
          <div className="bg-white rounded-3xl shadow-sm p-8">
            <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-4">
              <Check className="w-8 h-8" strokeWidth={2.5} />
            </div>
            <h2 className="font-extrabold text-xl mb-1 tracking-tight">¡Reserva confirmada!</h2>
            <p className="text-sm text-gray-400 mb-6 capitalize">
              {formatSlotDate(completedAppointment.startAt, bookingConfig!.timezone)} ·{' '}
              {formatSlotTime(completedAppointment.startAt, bookingConfig!.timezone)}
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
          </div>
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
  bookingConfig: BookingConfig | null;
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
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm font-semibold text-gray-500 mb-5">
        <ArrowLeft className="w-4 h-4" /> Volver a servicios
      </button>

      <div className="bg-white rounded-3xl shadow-sm p-5 mb-4">
        <h2 className="font-extrabold text-xl tracking-tight">{service.name}</h2>
        <p className="text-sm text-gray-400 mt-1">Elige una fecha · {service.durationMinutes} min · Bs. {service.price.toFixed(2)}</p>
      </div>

      <div className="bg-white rounded-3xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => setCalendarMonth((d) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 1, 1)))}
            className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100"
          >
            <ChevronLeft className="w-4 h-4 text-gray-500" />
          </button>
          <p className="font-extrabold text-[15px] capitalize">
            {MONTH_LABELS[month]} {year}
          </p>
          <button
            onClick={() => setCalendarMonth((d) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1)))}
            className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100"
          >
            <ChevronRight className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        <div className="grid grid-cols-7 mb-1">
          {WEEKDAY_LABELS.map((d, i) => (
            <div key={i} className="text-center text-[11px] font-bold text-gray-400 py-1">
              {d}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {cells.map((day, i) => {
            if (day === null) return <div key={`empty-${i}`} />;
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const disabled = dateStr < earliestStr || bookingConfig.dates.includes(dateStr);
            return (
              <div key={dateStr} className="flex items-center justify-center py-0.5">
                <button
                  disabled={disabled}
                  onClick={() => onSelectDate(dateStr)}
                  className="w-10 h-10 flex items-center justify-center rounded-full text-sm font-bold transition disabled:text-gray-300 disabled:cursor-not-allowed hover:enabled:bg-gray-100"
                  style={!disabled ? { color: buttonColor } : undefined}
                >
                  {day}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
}
