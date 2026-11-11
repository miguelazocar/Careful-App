/**
 * Builds the list of local notifications for upcoming services — pure and deterministic.
 *
 * Spec: notify at 4 moments — when the month starts, when the week starts, the day before and the
 * same day — plus a distance alert when fewer than 1,000 km remain.
 *
 * Logic fixes over the raw spec:
 *  - Moments that fall on the same day collapse into the most specific one
 *    (e.g. a service due on Monday the 1st only notifies "Hoy", not 3 times).
 *  - Moments already in the past are skipped (a service scheduled for next week never
 *    fires a late "este mes" notification).
 *  - Distance-based services use the *estimated* date from the average daily usage.
 *  - A gentle reminder to update the odometer keeps the estimates accurate.
 */
import { addDaysTo, atTime, monthStart, weekStart, formatDay } from '@/lib/dates';
import { formatInt } from '@/lib/format';

import type { UpcomingItem } from './schedule';

export type MomentKind = 'month' | 'week' | 'dayBefore' | 'sameDay' | 'km' | 'odometer';

/** Service notifications are always on (only the OS permission can block them); these tune when. */
export interface NotificationPrefs {
  hour: number;
  minute: number;
  month: boolean;
  week: boolean;
  dayBefore: boolean;
  sameDay: boolean;
  kmAlert: boolean;
  warnKm: number;
  /** Days without odometer updates before nudging the user (0 = off). */
  odometerNudgeDays: number;
}

export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  hour: 9,
  minute: 0,
  month: true,
  week: true,
  dayBefore: true,
  sameDay: true,
  kmAlert: true,
  warnKm: 1000,
  odometerNudgeDays: 30,
};

export interface PlannedNotification {
  id: string;
  date: Date;
  title: string;
  body: string;
  kind: MomentKind;
  data: { itemKey?: string; vehicleId: string };
}

/** Lower = more specific (wins when two moments land on the same day). */
const SPECIFICITY: Record<MomentKind, number> = {
  sameDay: 0,
  dayBefore: 1,
  km: 2,
  week: 3,
  month: 4,
  odometer: 5,
};

export interface VehicleLabelInfo {
  id: string;
  label: string;
  lastReadingDate: string | null;
}

export const MAX_SCHEDULED = 400;

export function planNotifications(
  items: UpcomingItem[],
  vehicles: VehicleLabelInfo[],
  prefs: NotificationPrefs,
  now: Date,
): PlannedNotification[] {
  const labelOf = (id: string) => vehicles.find((v) => v.id === id)?.label ?? 'Tu auto';
  const out: PlannedNotification[] = [];

  for (const it of items) {
    const vehicle = labelOf(it.vehicleId);
    const date = it.due.effectiveDate;
    const candidates: { kind: MomentKind; day: string }[] = [];

    if (date && it.due.status !== 'overdue') {
      if (prefs.month) candidates.push({ kind: 'month', day: monthStart(date) });
      if (prefs.week) candidates.push({ kind: 'week', day: weekStart(date) });
      if (prefs.dayBefore) candidates.push({ kind: 'dayBefore', day: addDaysTo(date, -1) });
      if (prefs.sameDay) candidates.push({ kind: 'sameDay', day: date });
    }
    if (prefs.kmAlert && it.due.kmWarningDate) {
      candidates.push({ kind: 'km', day: it.due.kmWarningDate });
    }

    // keep the most specific moment per day, drop past moments
    const byDay = new Map<string, MomentKind>();
    for (const c of candidates) {
      const at = atTime(c.day, prefs.hour, prefs.minute);
      if (at.getTime() <= now.getTime()) continue;
      const prev = byDay.get(c.day);
      if (!prev || SPECIFICITY[c.kind] < SPECIFICITY[prev]) byDay.set(c.day, c.kind);
    }

    for (const [day, kind] of byDay) {
      const { title, body } = message(kind, it, vehicle, date, prefs.warnKm);
      out.push({
        id: `${it.key}:${kind}`,
        date: atTime(day, prefs.hour, prefs.minute),
        title,
        body,
        kind,
        data: { itemKey: it.key, vehicleId: it.vehicleId },
      });
    }
  }

  if (prefs.odometerNudgeDays > 0) {
    for (const v of vehicles) {
      if (!v.lastReadingDate) continue;
      let day = addDaysTo(v.lastReadingDate, prefs.odometerNudgeDays);
      let at = atTime(day, prefs.hour, prefs.minute);
      if (at.getTime() <= now.getTime()) {
        // overdue nudge: remind tomorrow, once
        day = addDaysTo(formatIsoDay(now), 1);
        at = atTime(day, prefs.hour, prefs.minute);
      }
      out.push({
        id: `odo:${v.id}`,
        date: at,
        title: `¿Cuántos km tiene tu ${v.label}?`,
        body: 'Actualizá el kilometraje para que los avisos de service sean precisos.',
        kind: 'odometer',
        data: { vehicleId: v.id },
      });
    }
  }

  return out.sort((a, b) => a.date.getTime() - b.date.getTime()).slice(0, MAX_SCHEDULED);
}

function formatIsoDay(d: Date): string {
  const p = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function message(
  kind: MomentKind,
  it: UpcomingItem,
  vehicle: string,
  date: string | null,
  warnKm: number,
): { title: string; body: string } {
  const when = date ? formatDay(date) : '';
  const kmHint = it.due.trigger === 'km' && it.due.dueKm ? ` (a los ${formatInt(it.due.dueKm)} km, estimado)` : '';
  switch (kind) {
    case 'month':
      return { title: `Este mes: ${it.title}`, body: `${vehicle} · vence el ${when}${kmHint}` };
    case 'week':
      return { title: `Esta semana: ${it.title}`, body: `${vehicle} · vence el ${when}${kmHint}` };
    case 'dayBefore':
      return { title: `Mañana: ${it.title}`, body: `${vehicle} · agendalo para mañana${kmHint}` };
    case 'sameDay':
      return { title: `Hoy: ${it.title}`, body: `${vehicle} · vence hoy${kmHint}` };
    case 'km':
      return {
        title: `Faltan menos de ${formatInt(warnKm)} km: ${it.title}`,
        body: `${vehicle} · estimado según tu uso promedio${it.due.dueKm ? ` (service a los ${formatInt(it.due.dueKm)} km)` : ''}`,
      };
    default:
      return { title: it.title, body: vehicle };
  }
}
