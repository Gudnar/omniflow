// Appointment.startAt/endAt are real UTC instants — must be displayed in the
// appointment's BRANCH timezone, not the admin's own device timezone (which
// previously made `toLocaleString()` silently shift times whenever the
// viewer's browser wasn't in the same zone as the branch). Matches the
// storefront's formatSlotTime/formatSlotDate in tienda/[slug]/reservas.
export function formatZonedTime(iso: string, timeZone: string): string {
  return new Date(iso).toLocaleTimeString('es-BO', { timeZone, hour: '2-digit', minute: '2-digit', hour12: false });
}

export function formatZonedDateTime(iso: string, timeZone: string): string {
  return new Date(iso).toLocaleString('es-BO', { timeZone, dateStyle: 'medium', timeStyle: 'short', hour12: false });
}

// Calendar-day + hour/minute of a UTC instant as seen in `timeZone` — used
// by the week/day calendar grid to bucket and position an appointment block
// by its own branch's local time rather than the viewer's browser zone.
export function zonedDateParts(iso: string, timeZone: string): { year: number; month: number; day: number; hour: number; minute: number } {
  const parts: Record<string, string> = {};
  for (const part of new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(new Date(iso))) {
    if (part.type !== 'literal') parts[part.type] = part.value;
  }
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
  };
}

function getZonedOffsetMinutes(date: Date, timeZone: string): number {
  const parts: Record<string, string> = {};
  for (const part of new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(date)) {
    if (part.type !== 'literal') parts[part.type] = part.value;
  }
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
  return (asUtc - date.getTime()) / 60000;
}

// Formats a UTC instant as a `datetime-local` input value ("2026-10-12T10:30")
// in `timeZone`, for pre-filling the edit form.
export function utcToZonedInputValue(iso: string, timeZone: string): string {
  const parts: Record<string, string> = {};
  for (const part of new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(new Date(iso))) {
    if (part.type !== 'literal') parts[part.type] = part.value;
  }
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

// Inverse: converts a `datetime-local` input value, interpreted as
// wall-clock time in `timeZone`, into the real UTC instant it represents.
export function zonedInputValueToUtc(value: string, timeZone: string): Date {
  const naiveUtcMs = new Date(`${value}:00.000Z`).getTime();
  const offset1 = getZonedOffsetMinutes(new Date(naiveUtcMs), timeZone);
  let resultMs = naiveUtcMs - offset1 * 60000;
  const offset2 = getZonedOffsetMinutes(new Date(resultMs), timeZone);
  if (offset2 !== offset1) resultMs = naiveUtcMs - offset2 * 60000;
  return new Date(resultMs);
}
