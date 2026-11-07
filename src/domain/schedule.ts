/**
 * Service scheduling engine — pure functions, no I/O.
 *
 * A service is due by date (last service + N months) or by distance (last km + N km),
 * whichever comes first. Because the app has no live odometer, the distance-based due date is
 * *estimated* from the vehicle's average daily usage, computed from its odometer history.
 */
import { addDaysTo, addMonthsTo, daysBetween, minDay } from '@/lib/dates';
import { formatInt } from '@/lib/format';

import type { ManualReminder, ServiceRule } from '@/db/types';

import { findItem } from './maintenance';

export interface Reading {
  date: string;
  km: number;
}

export interface ScheduleContext {
  today: string;
  currentKm: number;
  /** Average km per day, or null when there is not enough history. */
  dailyKm: number | null;
  /** "Faltan menos de N km" threshold. Default 1000 (spec). */
  warnKm: number;
  /** Days before the date that count as "soon". */
  soonDays: number;
}

export type DueStatus = 'overdue' | 'soon' | 'ok';

export interface DueInfo {
  dueDate: string | null;
  dueKm: number | null;
  /** Estimated date the odometer reaches `dueKm`. */
  kmDate: string | null;
  /** min(dueDate, kmDate) — what the calendar shows. */
  effectiveDate: string | null;
  /** Which condition is expected first. */
  trigger: 'date' | 'km' | null;
  remainingKm: number | null;
  daysLeft: number | null;
  /** Estimated date when fewer than `warnKm` remain (for the km alert). */
  kmWarningDate: string | null;
  status: DueStatus;
  /** Fraction of the interval already consumed (0..1.5). */
  progress: number;
}

export interface DueTargets {
  dueDate: string | null;
  dueKm: number | null;
  startDate?: string | null;
  startKm?: number | null;
}

export const MAX_DAILY_KM = 1500;
export const MIN_HISTORY_DAYS = 14;

/** The odometer can only go up: the current value is the max known reading. */
export function currentOdometer(initialKm: number, readings: Reading[]): number {
  return readings.reduce((max, r) => (r.km > max ? r.km : max), initialKm || 0);
}

/**
 * Average daily km from the odometer history (last 12 months when possible).
 * Returns null when there are fewer than 2 readings spanning at least 14 days.
 */
export function estimateDailyKm(readings: Reading[], today: string): number | null {
  const sorted = [...readings].filter((r) => r.date <= today).sort((a, b) => (a.date === b.date ? a.km - b.km : a.date < b.date ? -1 : 1));
  if (sorted.length < 2) return null;
  const yearAgo = addDaysTo(today, -365);
  let window = sorted.filter((r) => r.date >= yearAgo);
  if (window.length < 2 || daysBetween(window[0].date, window[window.length - 1].date) < MIN_HISTORY_DAYS) {
    window = sorted;
  }
  const first = window[0];
  const last = window[window.length - 1];
  const days = daysBetween(first.date, last.date);
  if (days < MIN_HISTORY_DAYS) return null;
  const rate = (last.km - first.km) / days;
  if (!(rate > 0)) return null;
  return Math.min(rate, MAX_DAILY_KM);
}

export function computeDue(t: DueTargets, ctx: ScheduleContext): DueInfo {
  const { today, currentKm, dailyKm, warnKm, soonDays } = ctx;
  const remainingKm = t.dueKm !== null ? t.dueKm - currentKm : null;

  let kmDate: string | null = null;
  let kmWarningDate: string | null = null;
  if (remainingKm !== null && dailyKm) {
    kmDate = remainingKm <= 0 ? today : addDaysTo(today, Math.ceil(remainingKm / dailyKm));
    if (remainingKm > warnKm) kmWarningDate = addDaysTo(today, Math.ceil((remainingKm - warnKm) / dailyKm));
  }

  const effectiveDate = minDay(t.dueDate, kmDate);
  const trigger: DueInfo['trigger'] = kmDate && (!t.dueDate || kmDate < t.dueDate) ? 'km' : t.dueDate ? 'date' : null;
  const daysLeft = effectiveDate ? daysBetween(today, effectiveDate) : null;

  const overdue = (t.dueDate !== null && t.dueDate < today) || (remainingKm !== null && remainingKm <= 0);
  const soon =
    (daysLeft !== null && daysLeft <= soonDays) || (remainingKm !== null && remainingKm <= warnKm);
  const status: DueStatus = overdue ? 'overdue' : soon ? 'soon' : 'ok';

  let progress = 0;
  if (t.dueKm !== null && t.startKm !== null && t.startKm !== undefined && t.dueKm > t.startKm) {
    progress = Math.max(progress, (currentKm - t.startKm) / (t.dueKm - t.startKm));
  }
  if (t.dueDate && t.startDate) {
    const span = daysBetween(t.startDate, t.dueDate);
    if (span > 0) progress = Math.max(progress, daysBetween(t.startDate, today) / span);
  }
  progress = Math.min(Math.max(progress, 0), 1.5);

  return {
    dueDate: t.dueDate,
    dueKm: t.dueKm,
    kmDate,
    effectiveDate,
    trigger,
    remainingKm,
    daysLeft,
    kmWarningDate,
    status,
    progress,
  };
}

/* ------------------------------------------------------------------ */
/* Upcoming items (services derived from history + manual reminders)   */
/* ------------------------------------------------------------------ */

export interface Occurrence {
  item: string;
  category: string;
  date: string;
  odometer: number | null;
  recordId: string;
}

export interface UpcomingItem {
  key: string;
  source: 'service' | 'manual';
  vehicleId: string;
  title: string;
  item?: string;
  categoryKey?: string;
  reminderId?: string;
  lastDate?: string;
  lastKm?: number | null;
  intervalKm?: number | null;
  intervalMonths?: number | null;
  due: DueInfo;
}

export interface Interval {
  intervalKm: number | null;
  intervalMonths: number | null;
  enabled: boolean;
  custom: boolean;
}

/** Effective interval for an item: the vehicle's override if present, else the catalog default. */
export function resolveInterval(item: string, rules: ServiceRule[]): Interval {
  const rule = rules.find((r) => r.item === item);
  if (rule) {
    return { intervalKm: rule.intervalKm, intervalMonths: rule.intervalMonths, enabled: rule.enabled, custom: true };
  }
  const def = findItem(item)?.item;
  return {
    intervalKm: def?.intervalKm ?? null,
    intervalMonths: def?.intervalMonths ?? null,
    enabled: true,
    custom: false,
  };
}

export function buildServiceItems(
  vehicleId: string,
  occurrences: Occurrence[],
  rules: ServiceRule[],
  ctx: ScheduleContext,
): UpcomingItem[] {
  const out: UpcomingItem[] = [];
  for (const occ of occurrences) {
    const interval = resolveInterval(occ.item, rules);
    if (!interval.enabled || (!interval.intervalKm && !interval.intervalMonths)) continue;
    const dueDate = interval.intervalMonths ? addMonthsTo(occ.date, interval.intervalMonths) : null;
    const dueKm = interval.intervalKm && occ.odometer !== null ? occ.odometer + interval.intervalKm : null;
    if (!dueDate && dueKm === null) continue;
    const meta = findItem(occ.item);
    out.push({
      key: `svc:${vehicleId}:${occ.item}`,
      source: 'service',
      vehicleId,
      title: meta?.item.label ?? occ.item,
      item: occ.item,
      categoryKey: meta?.category.key ?? occ.category,
      lastDate: occ.date,
      lastKm: occ.odometer,
      intervalKm: interval.intervalKm,
      intervalMonths: interval.intervalMonths,
      due: computeDue({ dueDate, dueKm, startDate: occ.date, startKm: occ.odometer }, ctx),
    });
  }
  return out;
}

export function buildManualItems(reminders: ManualReminder[], ctxFor: (vehicleId: string) => ScheduleContext): UpcomingItem[] {
  return reminders
    .filter((r) => !r.doneAt && (r.dueDate || r.dueOdometer !== null))
    .map((r) => {
      const ctx = ctxFor(r.vehicleId);
      return {
        key: `rem:${r.id}`,
        source: 'manual' as const,
        vehicleId: r.vehicleId,
        title: r.title,
        reminderId: r.id,
        due: computeDue(
          { dueDate: r.dueDate, dueKm: r.dueOdometer, startDate: r.createdAt.slice(0, 10), startKm: null },
          ctx,
        ),
      };
    });
}

const STATUS_RANK: Record<DueStatus, number> = { overdue: 0, soon: 1, ok: 2 };

export function sortUpcoming(items: UpcomingItem[]): UpcomingItem[] {
  return [...items].sort((a, b) => {
    const s = STATUS_RANK[a.due.status] - STATUS_RANK[b.due.status];
    if (s) return s;
    const da = a.due.effectiveDate ?? '9999-12-31';
    const db = b.due.effectiveDate ?? '9999-12-31';
    if (da !== db) return da < db ? -1 : 1;
    return (a.due.remainingKm ?? Infinity) - (b.due.remainingKm ?? Infinity);
  });
}

/**
 * Checks a new odometer value against the history around its date.
 * Returns a human message when it is inconsistent (lower than an earlier reading or higher than a later one).
 */
export function validateOdometer(km: number, date: string, readings: Reading[], initialKm: number, excludeRecordKm?: number | null): string | null {
  const before = readings.filter((r) => r.date <= date && r.km !== excludeRecordKm);
  const after = readings.filter((r) => r.date > date && r.km !== excludeRecordKm);
  const maxBefore = before.reduce((m, r) => Math.max(m, r.km), initialKm || 0);
  const minAfter = after.reduce((m, r) => Math.min(m, r.km), Infinity);
  if (km < maxBefore) return `Es menor al último kilometraje registrado (${formatInt(maxBefore)} km).`;
  if (km > minAfter) return `Es mayor a un registro posterior (${formatInt(minAfter)} km).`;
  return null;
}
