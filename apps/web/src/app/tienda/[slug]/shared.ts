// Shared between the ecommerce storefront (/tienda/[slug]) and the booking
// storefront (/tienda/[slug]/reservas) — same store/token, separate pages.

// WhatsApp click-to-chat — the one existing mechanism for handing the
// customer back to the conversation once a purchase/reservation is placed.
export function waMeLink(phone: string, text: string) {
  return `https://wa.me/${phone.replace(/\D/g, '')}?text=${encodeURIComponent(text)}`;
}

// Derives a soft, light tint of a tenant brand color for badges/pills/
// placeholders, instead of hardcoding a second flat color per use.
export function tint(hex: string, pct: number) {
  return `color-mix(in srgb, ${hex} ${pct}%, white)`;
}

// Mirrors BookingStorefrontService.earliestBookableDate() on the backend —
// both operate on UTC calendar days so a date picked here always matches
// what the server will accept, regardless of the visitor's own timezone.
export function earliestBookableDateStr(minBookingLeadDays: number): string {
  const now = new Date();
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  d.setUTCDate(d.getUTCDate() + minBookingLeadDays);
  return d.toISOString().slice(0, 10);
}

export const WEEKDAY_LABELS = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];
export const MONTH_LABELS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];
