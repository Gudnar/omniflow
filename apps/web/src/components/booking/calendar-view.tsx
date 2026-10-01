'use client';

import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { Appointment, AppointmentStatus } from '@/lib/types';

// Fixed business-hours window — simpler and predictable than recomputing the
// axis from whatever appointments happen to be loaded; an appointment
// outside this range just clips at the edge (rare in practice).
const HOUR_START = 7;
const HOUR_END = 21;
const HOUR_HEIGHT = 56; // px per hour, Google Calendar-ish density
const GRID_HEIGHT = (HOUR_END - HOUR_START) * HOUR_HEIGHT;

const STATUS_BLOCK_STYLES: Record<AppointmentStatus, string> = {
  PENDING: 'bg-amber-100 border-amber-300 text-amber-900',
  CONFIRMED: 'bg-blue-100 border-blue-300 text-blue-900',
  COMPLETED: 'bg-emerald-100 border-emerald-300 text-emerald-900',
  CANCELLED: 'bg-gray-100 border-gray-300 text-gray-500 line-through opacity-70',
  NO_SHOW: 'bg-red-100 border-red-300 text-red-800',
};

const WEEKDAY_LABELS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const MONTH_LABELS = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

function startOfDay(d: Date): Date {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  return r;
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function startOfWeek(d: Date): Date {
  const r = startOfDay(d);
  const day = r.getDay(); // 0 = Sunday
  const diff = day === 0 ? -6 : 1 - day; // week starts Monday
  return addDays(r, diff);
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function minutesSinceMidnight(d: Date): number {
  return d.getHours() * 60 + d.getMinutes();
}

interface Positioned {
  appointment: Appointment;
  top: number;
  height: number;
  lane: number;
  laneCount: number;
}

// Greedy interval partitioning: overlapping appointments on the same day
// split into side-by-side "lanes" instead of stacking on top of each other —
// same idea Google Calendar uses for a double-booked slot.
function layoutDay(appointments: Appointment[]): Positioned[] {
  const clampedMin = HOUR_START * 60;
  const clampedMax = HOUR_END * 60;

  const items = appointments
    .map((a) => {
      const start = Math.max(clampedMin, minutesSinceMidnight(new Date(a.startAt)));
      const end = Math.min(clampedMax, Math.max(start + 15, minutesSinceMidnight(new Date(a.endAt))));
      return { appointment: a, start, end };
    })
    .sort((a, b) => a.start - b.start);

  const laneEnds: number[] = [];
  const laneOf = new Map<string, number>();
  for (const item of items) {
    let placedLane = laneEnds.findIndex((end) => end <= item.start);
    if (placedLane === -1) {
      placedLane = laneEnds.length;
      laneEnds.push(item.end);
    } else {
      laneEnds[placedLane] = item.end;
    }
    laneOf.set(item.appointment.id, placedLane);
  }
  const laneCount = Math.max(1, laneEnds.length);

  return items.map((item) => ({
    appointment: item.appointment,
    top: ((item.start - clampedMin) / (clampedMax - clampedMin)) * GRID_HEIGHT,
    height: Math.max(18, ((item.end - item.start) / (clampedMax - clampedMin)) * GRID_HEIGHT),
    lane: laneOf.get(item.appointment.id) ?? 0,
    laneCount,
  }));
}

function AppointmentBlock({ item, onSelect }: { item: Positioned; onSelect: (id: string) => void }) {
  const { appointment: a } = item;
  const widthPct = 100 / item.laneCount;
  const leftPct = item.lane * widthPct;
  const time = new Date(a.startAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const resourceName = a.resources[0]?.resource.name;

  return (
    <button
      onClick={() => onSelect(a.id)}
      className={`absolute rounded-md border px-1.5 py-1 text-left overflow-hidden hover:shadow-md hover:z-10 transition-shadow ${STATUS_BLOCK_STYLES[a.status]}`}
      style={{
        top: item.top,
        height: item.height,
        left: `calc(${leftPct}% + 2px)`,
        width: `calc(${widthPct}% - 4px)`,
      }}
      title={`${time} · ${a.contact.name} · ${a.services.map((s) => s.serviceNameSnapshot).join(', ')}`}
    >
      <p className="text-[11px] font-semibold leading-tight truncate">{time} · {a.contact.name}</p>
      {item.height > 32 && (
        <p className="text-[10px] leading-tight truncate opacity-80">
          {a.services.map((s) => s.serviceNameSnapshot).join(', ')}
          {resourceName ? ` · ${resourceName}` : ''}
        </p>
      )}
    </button>
  );
}

function TimeGutter() {
  const hours = Array.from({ length: HOUR_END - HOUR_START }, (_, i) => HOUR_START + i);
  return (
    <div className="w-14 shrink-0 relative" style={{ height: GRID_HEIGHT }}>
      {hours.map((h) => (
        <div key={h} className="absolute right-2 -translate-y-1/2 text-[11px] text-gray-400" style={{ top: (h - HOUR_START) * HOUR_HEIGHT }}>
          {h % 12 === 0 ? 12 : h % 12}{h < 12 ? 'am' : 'pm'}
        </div>
      ))}
    </div>
  );
}

function DayColumn({
  date,
  appointments,
  onSelect,
  isToday,
}: {
  date: Date;
  appointments: Appointment[];
  onSelect: (id: string) => void;
  isToday: boolean;
}) {
  const dayAppointments = appointments.filter((a) => isSameDay(new Date(a.startAt), date));
  const positioned = useMemo(() => layoutDay(dayAppointments), [dayAppointments]);
  const hours = Array.from({ length: HOUR_END - HOUR_START }, (_, i) => HOUR_START + i);

  const now = new Date();
  const showNowLine = isToday && now.getHours() >= HOUR_START && now.getHours() < HOUR_END;
  const nowTop = ((minutesSinceMidnight(now) - HOUR_START * 60) / ((HOUR_END - HOUR_START) * 60)) * GRID_HEIGHT;

  return (
    <div className={`flex-1 min-w-0 relative border-l border-gray-100 ${isToday ? 'bg-blue-50/30' : ''}`} style={{ height: GRID_HEIGHT }}>
      {hours.map((h) => (
        <div key={h} className="absolute left-0 right-0 border-t border-gray-100" style={{ top: (h - HOUR_START) * HOUR_HEIGHT }} />
      ))}
      {showNowLine && (
        <div className="absolute left-0 right-0 z-10 flex items-center" style={{ top: nowTop }}>
          <div className="w-1.5 h-1.5 rounded-full bg-red-500 -ml-0.5" />
          <div className="flex-1 h-px bg-red-500" />
        </div>
      )}
      {positioned.map((item) => (
        <AppointmentBlock key={item.appointment.id} item={item} onSelect={onSelect} />
      ))}
      {dayAppointments.length === 0 && (
        <p className="absolute inset-x-0 top-4 text-center text-xs text-gray-300">Sin citas</p>
      )}
    </div>
  );
}

export function CalendarView({
  mode,
  appointments,
  onSelect,
}: {
  mode: 'week' | 'day';
  appointments: Appointment[];
  onSelect: (id: string) => void;
}) {
  const [anchor, setAnchor] = useState(() => new Date());
  const today = new Date();

  const rangeStart = mode === 'week' ? startOfWeek(anchor) : startOfDay(anchor);
  const days = mode === 'week' ? Array.from({ length: 7 }, (_, i) => addDays(rangeStart, i)) : [startOfDay(anchor)];
  const rangeEnd = addDays(rangeStart, days.length - 1);

  const navigate = (dir: -1 | 1) => setAnchor((prev) => addDays(prev, dir * (mode === 'week' ? 7 : 1)));
  const goToday = () => setAnchor(new Date());

  const rangeLabel =
    mode === 'day'
      ? `${rangeStart.getDate()} de ${MONTH_LABELS[rangeStart.getMonth()]}, ${rangeStart.getFullYear()}`
      : rangeStart.getMonth() === rangeEnd.getMonth()
        ? `${rangeStart.getDate()} – ${rangeEnd.getDate()} de ${MONTH_LABELS[rangeStart.getMonth()]}, ${rangeStart.getFullYear()}`
        : `${rangeStart.getDate()} de ${MONTH_LABELS[rangeStart.getMonth()]} – ${rangeEnd.getDate()} de ${MONTH_LABELS[rangeEnd.getMonth()]}, ${rangeEnd.getFullYear()}`;

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <button
            onClick={goToday}
            className="px-3 py-1.5 text-xs font-semibold border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
          >
            Hoy
          </button>
          <button onClick={() => navigate(-1)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button onClick={() => navigate(1)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">
            <ChevronRight className="w-4 h-4" />
          </button>
          <p className="text-sm font-semibold text-gray-900 ml-1 capitalize">{rangeLabel}</p>
        </div>
      </div>

      <div className="flex border-b border-gray-100">
        <div className="w-14 shrink-0" />
        {days.map((d) => {
          const isToday = isSameDay(d, today);
          return (
            <div key={d.toISOString()} className={`flex-1 min-w-0 text-center py-2 border-l border-gray-100 ${isToday ? 'bg-blue-50/50' : ''}`}>
              <p className="text-[11px] font-medium text-gray-400">{WEEKDAY_LABELS[d.getDay()]}</p>
              <p className={`text-sm font-semibold mt-0.5 ${isToday ? 'text-blue-600' : 'text-gray-900'}`}>
                {isToday ? (
                  <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-600 text-white">{d.getDate()}</span>
                ) : (
                  d.getDate()
                )}
              </p>
            </div>
          );
        })}
      </div>

      <div className="flex overflow-y-auto pt-2" style={{ maxHeight: '65vh' }}>
        <TimeGutter />
        {days.map((d) => (
          <DayColumn key={d.toISOString()} date={d} appointments={appointments} onSelect={onSelect} isToday={isSameDay(d, today)} />
        ))}
      </div>
    </div>
  );
}
