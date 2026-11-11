/**
 * Builds the list of local notifications for upcoming services — pure and deterministic.
 *
 * Every service (oil change, coolant, VTV…) is due by date or by km, whichever comes first:
 *  - **Weekly reminder** from the moment fewer than `warnKm` km remain (1.000 by default) or one
 *    month before the date — whichever happens first — and it keeps coming every week, even once
 *    the service is overdue, until a new one is logged (logging it replaces the whole schedule).
 *  - "Mañana" and "Hoy" on the due date itself.
 *  - A nudge to update the odometer, so the km estimates stay accurate.
 *
 * The weekly cadence is anchored to the due date (or to the last service), not to "today":
 * the plan is rebuilt every time the app opens, and a cadence based on today would keep
 * postponing the next reminder.
 */
import { addDaysTo, addMonthsTo, atTime, daysBetween, formatDay } from '@/lib/dates';
import { formatInt } from '@/lib/format';

import type { UpcomingItem } from './schedule';

export type MomentKind = 'weekly' | 'dayBefore' | 'sameDay' | 'odometer';

/** Service notifications are always on (only the OS permission can block them); these tune when. */
export interface NotificationPrefs {
  hour: number;
  minute: number;
  /** Weekly reminder from 1 month / `warnKm` before the service until it is logged. */
  weekly: boolean;
  dayBefore: boolean;
  sameDay: boolean;
  /** Count km too: start the weekly reminder when fewer than `warnKm` km remain, and alert right away. */
  kmAlert: boolean;
  warnKm: number;
  /** Days without odometer updates before nudging the user (0 = off). */
  odometerNudgeDays: number;
}

export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  hour: 9,
  minute: 0,
  weekly: true,
  dayBefore: true,
  sameDay: true,
  kmAlert: true,
  warnKm: 1000,
  odometerNudgeDays: 30,
};

/** The weekly reminder starts this many months before the due date. */
export const LEAD_MONTHS = 1;
/** Weekly reminders scheduled ahead per service (the plan is rebuilt on every launch). */
export const WEEKS_AHEAD = 8;

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
  weekly: 2,
  odometer: 3,
};

export interface VehicleLabelInfo {
  id: string;
  label: string;
  lastReadingDate: string | null;
}

export const MAX_SCHEDULED = 400;

/** First day the weekly reminder applies: 1 month before the date or `warnKm` before the km. */
export function reminderStart(it: UpcomingItem, prefs: Pick<NotificationPrefs, 'kmAlert' | 'warnKm'>, today: string): string | null {
  const starts: string[] = [];
  if (it.due.dueDate) starts.push(addMonthsTo(it.due.dueDate, -LEAD_MONTHS));
  if (prefs.kmAlert && it.due.remainingKm !== null) {
    if (it.due.remainingKm <= prefs.warnKm) starts.push(today);
    else if (it.due.kmWarningDate) starts.push(it.due.kmWarningDate);
  }
  return starts.length ? starts.sort()[0] : null;
}

export function planNotifications(
  items: UpcomingItem[],
  vehicles: VehicleLabelInfo[],
  prefs: NotificationPrefs,
  now: Date,
): PlannedNotification[] {
  const labelOf = (id: string) => vehicles.find((v) => v.id === id)?.label ?? 'Tu auto';
  const today = isoDay(now);
  const future = (day: string) => atTime(day, prefs.hour, prefs.minute).getTime() > now.getTime();
  const out: PlannedNotification[] = [];

  for (const it of items) {
    const vehicle = labelOf(it.vehicleId);
    const byDay = new Map<string, MomentKind>();
    const put = (day: string, kind: MomentKind) => {
      if (!future(day)) return;
      const prev = byDay.get(day);
      if (!prev || SPECIFICITY[kind] < SPECIFICITY[prev]) byDay.set(day, kind);
    };

    if (prefs.weekly) {
      const start = reminderStart(it, prefs, today);
      if (start) {
        // cadence anchored to the due date (stable across rebuilds)
        const anchor = it.due.dueDate ?? it.lastDate ?? start;
        const from = start > today ? start : today;
        let day = addDaysTo(anchor, Math.ceil(daysBetween(anchor, from) / 7) * 7);
        if (!future(day)) day = addDaysTo(day, 7);
        for (let n = 0; n < WEEKS_AHEAD; n++, day = addDaysTo(day, 7)) put(day, 'weekly');
      }
    }
    if (it.due.dueDate) {
      if (prefs.dayBefore) put(addDaysTo(it.due.dueDate, -1), 'dayBefore');
      if (prefs.sameDay) put(it.due.dueDate, 'sameDay');
    }

    for (const [day, kind] of byDay) {
      const { title, body } = message(kind, it, vehicle, day);
      out.push({
        id: kind === 'weekly' ? `${it.key}:w:${day}` : `${it.key}:${kind}`,
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
      if (!future(day)) day = addDaysTo(today, 1); // overdue nudge: remind tomorrow, once
      out.push({
        id: `odo:${v.id}`,
        date: atTime(day, prefs.hour, prefs.minute),
        title: `¿Cuántos km tiene tu ${v.label}?`,
        body: 'Actualizá el kilometraje para que los avisos de service sean precisos.',
        kind: 'odometer',
        data: { vehicleId: v.id },
      });
    }
  }

  return out.sort((a, b) => a.date.getTime() - b.date.getTime()).slice(0, MAX_SCHEDULED);
}

function isoDay(d: Date): string {
  const p = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** "a los 95.000 km o el 11 nov 2027 (lo que ocurra primero)". */
export function dueText(due: { dueKm: number | null; dueDate: string | null }): string {
  const km = due.dueKm !== null ? `a los ${formatInt(due.dueKm)} km` : null;
  const date = due.dueDate ? `el ${formatDay(due.dueDate)}` : null;
  if (km && date) return `${km} o ${date} (lo que ocurra primero)`;
  return km ?? date ?? '';
}

function message(kind: MomentKind, it: UpcomingItem, vehicle: string, day: string): { title: string; body: string } {
  const overdue = (it.due.dueDate !== null && day > it.due.dueDate) || (it.due.remainingKm !== null && it.due.remainingKm <= 0);
  switch (kind) {
    case 'dayBefore':
      return { title: `Mañana: ${it.title}`, body: `${vehicle} · agendalo para mañana` };
    case 'sameDay':
      return { title: `Hoy: ${it.title}`, body: `${vehicle} · vence hoy` };
    default:
      return overdue
        ? { title: `Vencido: ${it.title}`, body: `${vehicle} · registralo cuando lo hagas y dejamos de avisarte` }
        : { title: `Se acerca: ${it.title}`, body: `${vehicle} · ${dueText(it.due)}` };
  }
}
