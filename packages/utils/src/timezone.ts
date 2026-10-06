// Timezone-aware conversions between "wall-clock minutes in a branch's IANA
// zone" (how BookingResourceSchedule/availability slots are authored and
// displayed) and real UTC instants (how everything is stored). Implemented
// on top of Intl.DateTimeFormat rather than a date library — avoids a new
// dependency for what's otherwise a ~20-line offset lookup, and Node's ICU
// build already covers the full IANA database.

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

// Converts a calendar date ("2026-10-12") + minutes-since-midnight,
// interpreted as wall-clock time in `timeZone`, into the UTC instant it
// represents. Two-pass offset resolution handles the rare case where the
// naive guess lands on the other side of a DST transition.
export function zonedDateTimeToUtc(dateStr: string, minutesFromMidnight: number, timeZone: string): Date {
  const naiveUtcMs = new Date(`${dateStr}T00:00:00.000Z`).getTime() + minutesFromMidnight * 60000;
  const offset1 = getZonedOffsetMinutes(new Date(naiveUtcMs), timeZone);
  let resultMs = naiveUtcMs - offset1 * 60000;
  const offset2 = getZonedOffsetMinutes(new Date(resultMs), timeZone);
  if (offset2 !== offset1) resultMs = naiveUtcMs - offset2 * 60000;
  return new Date(resultMs);
}

// Inverse: given a UTC instant, returns its calendar date and
// minutes-since-midnight as seen in `timeZone`.
export function utcToZonedDateTime(date: Date, timeZone: string): { dateStr: string; minutes: number } {
  const parts: Record<string, string> = {};
  for (const part of new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(date)) {
    if (part.type !== 'literal') parts[part.type] = part.value;
  }
  return {
    dateStr: `${parts.year}-${parts.month}-${parts.day}`,
    minutes: Number(parts.hour) * 60 + Number(parts.minute),
  };
}
