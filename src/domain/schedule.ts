/**
 * Service scheduling engine — pure functions, no I/O.
 *
 * A service is due by date (last service + N months) or by distance (last km + N km),
 * whichever comes first. Because the app has no live odometer, the distance-based due date is
 * *estimated* from the vehicle's average daily usage, computed from its odometer history.
 *
 * Only the maintenance plan (PLAN_ITEMS: oil, filters, spark plugs, timing kit) is scheduled, and
 * always: before the first one is logged, each is estimated from the next km milestone or the date
 * the vehicle was added (see buildEstimatedItems).
 */
import { addDaysTo, addMonthsTo, daysBetween, minDay } from '@/lib/dates';
import { formatInt } from '@/lib/format';

import type { ManualReminder, ServiceRule } from '@/db/types';

import { findItem, isTrackedItem, PLAN_ITEMS } from './maintenance';

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
  /** Interval chosen when this service was logged; overrides the vehicle's plan. */
  intervalKm?: number | null;
  intervalMonths?: number | null;
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
  /** First service estimated without history (never logged yet). */
  estimated?: boolean;
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

/** Interval for an occurrence: the one chosen when it was logged, else the vehicle's plan. */
export function occurrenceInterval(occ: Occurrence, rules: ServiceRule[]): Interval {
  const plan = resolveInterval(occ.item, rules);
  const own = (occ.intervalKm ?? null) !== null || (occ.intervalMonths ?? null) !== null;
  if (!own) return plan;
  return { intervalKm: occ.intervalKm ?? null, intervalMonths: occ.intervalMonths ?? null, enabled: plan.enabled, custom: true };
}

/** When the next service falls after one done on `date` at `km` (what the form previews). */
export function nextDueFrom(date: string, km: number | null, interval: Pick<Interval, 'intervalKm' | 'intervalMonths'>): { dueDate: string | null; dueKm: number | null } {
  return {
    dueDate: interval.intervalMonths ? addMonthsTo(date, interval.intervalMonths) : null,
    dueKm: interval.intervalKm && km !== null ? km + interval.intervalKm : null,
  };
}

/**
 * One item per plan item, from its latest occurrence: logging a new one replaces the previous
 * schedule and starts counting again from that date and km. Anything outside the plan is history
 * only, even if an older version stored an interval for it.
 */
export function buildServiceItems(
  vehicleId: string,
  occurrences: Occurrence[],
  rules: ServiceRule[],
  ctx: ScheduleContext,
): UpcomingItem[] {
  const out: UpcomingItem[] = [];
  for (const occ of occurrences) {
    if (!isTrackedItem(occ.item)) continue;
    const interval = occurrenceInterval(occ, rules);
    if (!interval.enabled || (!interval.intervalKm && !interval.intervalMonths)) continue;
    const { dueDate, dueKm } = nextDueFrom(occ.date, occ.odometer, interval);
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

/** Items scheduled even before they are ever logged: the whole maintenance plan. */
export const ALWAYS_SCHEDULED: readonly string[] = PLAN_ITEMS.map((p) => p.item);

/**
 * First service for plan items that were never logged, so reminders work from day one:
 * the next km milestone (a multiple of the interval, like manufacturer service plans: 10.000,
 * 20.000…) or `since` (the date the vehicle was added) + the interval, whichever comes first.
 * Logging the real service replaces the estimate.
 */
export function buildEstimatedItems(vehicleId: string, occurrences: Occurrence[], rules: ServiceRule[], ctx: ScheduleContext, since: string): UpcomingItem[] {
  const out: UpcomingItem[] = [];
  for (const item of ALWAYS_SCHEDULED) {
    if (occurrences.some((o) => o.item === item)) continue;
    const interval = resolveInterval(item, rules);
    if (!interval.enabled || (!interval.intervalKm && !interval.intervalMonths)) continue;
    const step = interval.intervalKm;
    const dueKm = step ? (Math.floor(Math.max(0, ctx.currentKm) / step) + 1) * step : null;
    const dueDate = interval.intervalMonths ? addMonthsTo(since, interval.intervalMonths) : null;
    const meta = findItem(item);
    out.push({
      key: `svc:${vehicleId}:${item}`,
      source: 'service',
      vehicleId,
      title: meta?.item.label ?? item,
      item,
      categoryKey: meta?.category.key,
      intervalKm: interval.intervalKm,
      intervalMonths: interval.intervalMonths,
      estimated: true,
      due: computeDue({ dueDate, dueKm, startDate: since, startKm: dueKm !== null && step ? dueKm - step : null }, ctx),
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

/** No car odometer goes this far: anything above is a typo. */
export const MAX_ODOMETER = 1_999_999;
/** A jump bigger than this since the previous reading is asked for confirmation. */
export const ODOMETER_JUMP_KM = 100_000;

/** Hard error (the value is impossible), or null. */
export function odometerError(km: number): string | null {
  return km > MAX_ODOMETER ? `${formatInt(km)} km no es un kilometraje posible. Revisá el número.` : null;
}

/**
 * Checks a new odometer value against the history around its date.
 * Returns a human message when it is inconsistent (lower than an earlier reading, higher than a
 * later one, or a suspiciously big jump), so the user can confirm or fix it.
 */
export function validateOdometer(km: number, date: string, readings: Reading[], initialKm: number, excludeRecordKm?: number | null): string | null {
  const before = readings.filter((r) => r.date <= date && r.km !== excludeRecordKm);
  const after = readings.filter((r) => r.date > date && r.km !== excludeRecordKm);
  const maxBefore = before.reduce((m, r) => Math.max(m, r.km), initialKm || 0);
  const minAfter = after.reduce((m, r) => Math.min(m, r.km), Infinity);
  if (km < maxBefore) return `Es menor al último kilometraje registrado (${formatInt(maxBefore)} km).`;
  if (km > minAfter) return `Es mayor a un registro posterior (${formatInt(minAfter)} km).`;
  if (km - maxBefore > ODOMETER_JUMP_KM) return `Son ${formatInt(km - maxBefore)} km más que el último registro (${formatInt(maxBefore)} km).`;
  return null;
}
