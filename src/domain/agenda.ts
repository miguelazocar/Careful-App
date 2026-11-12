/**
 * Agenda: what has to be done, in chronological order — pure functions, no I/O.
 *
 * Overdue items first, then one section per month of their expected date, then the ones whose
 * date can't be estimated yet (km-only targets without enough odometer history).
 */
import { formatMonth } from '@/lib/dates';

import type { UpcomingItem } from './schedule';

/** Type filter value for manual reminders (VTV, seguro…); any other value is a plan item key. */
export const MANUAL_TYPE = 'manual';

export interface AgendaFilter {
  /** null = every vehicle. */
  vehicleId: string | null;
  /** null = every type; a plan item key (`motor.aceite`…) or MANUAL_TYPE. */
  type: string | null;
}

export interface AgendaSection {
  key: string;
  title: string;
  kind: 'overdue' | 'month' | 'undated';
  items: UpcomingItem[];
}

export function matchesAgendaFilter(it: UpcomingItem, f: AgendaFilter): boolean {
  if (f.vehicleId && it.vehicleId !== f.vehicleId) return false;
  if (f.type === MANUAL_TYPE) return it.source === 'manual';
  if (f.type) return it.source === 'service' && it.item === f.type;
  return true;
}

const byKm = (a: UpcomingItem, b: UpcomingItem) => (a.due.remainingKm ?? Infinity) - (b.due.remainingKm ?? Infinity);

const byDate = (a: UpcomingItem, b: UpcomingItem) => {
  const da = a.due.effectiveDate ?? '9999-12-31';
  const db = b.due.effectiveDate ?? '9999-12-31';
  return da !== db ? (da < db ? -1 : 1) : byKm(a, b) || a.title.localeCompare(b.title, 'es');
};

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function agendaSections(items: UpcomingItem[]): AgendaSection[] {
  const sections: AgendaSection[] = [];
  const overdue = items.filter((i) => i.due.status === 'overdue').sort(byDate);
  if (overdue.length) sections.push({ key: 'overdue', title: 'Vencidos', kind: 'overdue', items: overdue });

  const pending = items.filter((i) => i.due.status !== 'overdue');
  for (const it of pending.filter((i) => i.due.effectiveDate).sort(byDate)) {
    const month = it.due.effectiveDate!.slice(0, 7);
    const last = sections[sections.length - 1];
    if (last?.key === month) last.items.push(it);
    else sections.push({ key: month, title: capitalize(formatMonth(month)), kind: 'month', items: [it] });
  }

  const undated = pending.filter((i) => !i.due.effectiveDate).sort(byKm);
  if (undated.length) sections.push({ key: 'undated', title: 'Sin fecha estimada', kind: 'undated', items: undated });
  return sections;
}
