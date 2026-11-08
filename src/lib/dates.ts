import { addDays, addMonths, differenceInCalendarDays, format, isValid, parse, startOfMonth, startOfWeek } from 'date-fns';
import { es } from 'date-fns/locale/es';

/**
 * All calendar dates in Careful are stored as local "YYYY-MM-DD" strings.
 * Times only matter for notifications, which are built from these dates + a preferred hour.
 */

const ISO_DAY = 'yyyy-MM-dd';

export function toDay(d: Date): string {
  return format(d, ISO_DAY);
}

export function parseDay(s: string): Date {
  const d = parse(s, ISO_DAY, new Date(2000, 0, 1));
  if (!isValid(d)) throw new Error(`Invalid date: ${s}`);
  return d;
}

export function isDay(s: unknown): s is string {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && isValid(parse(s, ISO_DAY, new Date()));
}

export function today(now: Date = new Date()): string {
  return toDay(now);
}

export function addDaysTo(day: string, n: number): string {
  return toDay(addDays(parseDay(day), n));
}

export function addMonthsTo(day: string, n: number): string {
  return toDay(addMonths(parseDay(day), n));
}

/** b - a in calendar days. */
export function daysBetween(a: string, b: string): number {
  return differenceInCalendarDays(parseDay(b), parseDay(a));
}

export function minDay(a: string | null | undefined, b: string | null | undefined): string | null {
  if (!a) return b ?? null;
  if (!b) return a;
  return a <= b ? a : b;
}

export function monthStart(day: string): string {
  return toDay(startOfMonth(parseDay(day)));
}

/** Monday-based week start (es-AR convention). */
export function weekStart(day: string): string {
  return toDay(startOfWeek(parseDay(day), { weekStartsOn: 1 }));
}

/** Combines a calendar day with an hour/minute in local time. */
export function atTime(day: string, hour: number, minute = 0): Date {
  const d = parseDay(day);
  d.setHours(hour, minute, 0, 0);
  return d;
}

export function formatDay(day: string, pattern = "d MMM yyyy"): string {
  return format(parseDay(day), pattern, { locale: es }).replace('.', '');
}

export function formatDayLong(day: string): string {
  return format(parseDay(day), "EEEE d 'de' MMMM 'de' yyyy", { locale: es });
}

export function formatMonth(month: string): string {
  // month = YYYY-MM
  return format(parseDay(`${month}-01`), 'MMMM yyyy', { locale: es });
}

export function formatMonthShort(month: string): string {
  return format(parseDay(`${month}-01`), 'MMM', { locale: es }).replace('.', '');
}

/** A past instant (ISO timestamp) in local time: "hoy 21:36", "ayer 09:05", "7 nov 2026, 21:36". */
export function formatMoment(iso: string, now: Date = new Date()): string {
  const d = new Date(iso);
  if (!isValid(d)) return '';
  const day = toDay(d);
  const time = format(d, 'HH:mm');
  const diff = daysBetween(today(now), day);
  if (diff === 0) return `hoy ${time}`;
  if (diff === -1) return `ayer ${time}`;
  return `${formatDay(day)}, ${time}`;
}

export function relativeDays(day: string, now: Date = new Date()): string {
  const diff = daysBetween(today(now), day);
  if (diff === 0) return 'hoy';
  if (diff === 1) return 'mañana';
  if (diff === -1) return 'ayer';
  if (diff > 0) {
    if (diff < 45) return `en ${diff} días`;
    const months = Math.round(diff / 30.4);
    return months < 18 ? `en ${months} ${months === 1 ? 'mes' : 'meses'}` : `en ${Math.round(diff / 365)} años`;
  }
  const ago = -diff;
  if (ago < 45) return `hace ${ago} días`;
  const months = Math.round(ago / 30.4);
  return months < 18 ? `hace ${months} ${months === 1 ? 'mes' : 'meses'}` : `hace ${Math.round(ago / 365)} años`;
}
