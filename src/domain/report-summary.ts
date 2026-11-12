/**
 * Figures for the vehicle report (PDF) — pure, so they can be tested.
 * "Desde el alta" = since the vehicle was added to Careful (or its oldest record, if earlier).
 */
import { daysBetween, minDay } from '@/lib/dates';

import type { LogRecordFull, Vehicle } from '@/db/types';

import { ACCESSORY_CATEGORY, accessoryTag, CORE_ITEM, findCategory } from './maintenance';

export interface SpendGroup {
  key: string;
  label: string;
  color: string;
  cents: number;
  count: number;
}

export interface ReportSummary {
  since: string;
  /** Months of history (since → today), at least 0. */
  months: number;
  kmStart: number;
  kmNow: number;
  kmDriven: number;
  /** Average km per month, from the usage estimate or the whole history. */
  kmPerMonth: number | null;
  totalCents: number;
  serviceCents: number;
  accessoryCents: number;
  /** Total spent per km driven, in cents. */
  costPerKmCents: number | null;
  records: number;
  services: number;
  accessories: number;
  odometerUpdates: number;
  oilChanges: number;
  lastOilChange: { date: string; km: number | null } | null;
  firstService: string | null;
  lastService: string | null;
  firstAccessory: string | null;
  lastAccessory: string | null;
  /** Spending per category, biggest first. */
  byGroup: SpendGroup[];
  /** Services and maintenance per category (every record, with or without amount), biggest first. */
  serviceGroups: SpendGroup[];
  /** Accessories per tag ("Sin etiqueta" when none), biggest first. */
  accessoryTags: SpendGroup[];
}

const DAYS_PER_MONTH = 30.44;

const biggestFirst = (a: SpendGroup, b: SpendGroup) => b.cents - a.cents || b.count - a.count || a.label.localeCompare(b.label, 'es');

function groupBy(records: LogRecordFull[], keyOf: (r: LogRecordFull) => Omit<SpendGroup, 'cents' | 'count'>): SpendGroup[] {
  const groups = new Map<string, SpendGroup>();
  for (const r of records) {
    const k = keyOf(r);
    const g = groups.get(k.key) ?? { ...k, cents: 0, count: 0 };
    g.cents += r.amountCents ?? 0;
    g.count += 1;
    groups.set(k.key, g);
  }
  return [...groups.values()].sort(biggestFirst);
}

const dateRange = (list: LogRecordFull[]) => ({
  first: list.reduce<string | null>((m, r) => (!m || r.date < m ? r.date : m), null),
  last: list.reduce<string | null>((m, r) => (!m || r.date > m ? r.date : m), null),
});

export function summarizeHistory(
  vehicle: Pick<Vehicle, 'createdAt' | 'initialOdometer'>,
  records: LogRecordFull[],
  current: { km: number; dailyKm: number | null },
  today: string,
): ReportSummary {
  const added = vehicle.createdAt.slice(0, 10);
  const oldest = records.reduce<string | null>((m, r) => minDay(m, r.date), null);
  const since = minDay(added, oldest) ?? added;
  const days = Math.max(0, daysBetween(since, today));
  const months = Math.floor(days / DAYS_PER_MONTH);
  const kmStart = Math.min(vehicle.initialOdometer || 0, ...records.filter((r) => r.odometer !== null).map((r) => r.odometer as number));
  const kmDriven = Math.max(0, current.km - kmStart);

  const services = records.filter((r) => r.kind === 'maintenance');
  const accessories = records.filter((r) => r.kind === 'accessory');
  const sum = (list: LogRecordFull[]) => list.reduce((s, r) => s + (r.amountCents ?? 0), 0);
  const totalCents = sum(records);

  const oil = services.filter((r) => r.items.some((i) => i.item === CORE_ITEM)).sort((a, b) => (a.date < b.date ? 1 : -1));

  const groups = new Map<string, SpendGroup>();
  for (const r of records) {
    if (r.kind === 'odometer' || !r.amountCents) continue;
    const cat = r.kind === 'accessory' ? ACCESSORY_CATEGORY : findCategory(r.items[0]?.category ?? '');
    const key = cat?.key ?? 'otros';
    const g = groups.get(key) ?? { key, label: cat?.label ?? 'Otros', color: cat?.color ?? '#64748B', cents: 0, count: 0 };
    g.cents += r.amountCents;
    g.count += 1;
    groups.set(key, g);
  }

  const serviceDates = dateRange(services);
  const accessoryDates = dateRange(accessories);
  const serviceGroups = groupBy(services, (r) => {
    const cat = findCategory(r.items[0]?.category ?? '');
    return { key: cat?.key ?? 'otros', label: cat?.label ?? 'Otros', color: cat?.color ?? '#64748B' };
  });
  const accessoryTags = groupBy(accessories, (r) => {
    const tag = r.items[0] ? accessoryTag(r.items[0].item) : undefined;
    return { key: tag?.key ?? 'sin-etiqueta', label: tag?.label ?? 'Sin etiqueta', color: ACCESSORY_CATEGORY.color };
  });

  const kmPerMonth = current.dailyKm ? current.dailyKm * DAYS_PER_MONTH : days >= 30 && kmDriven > 0 ? (kmDriven / days) * DAYS_PER_MONTH : null;

  return {
    since,
    months,
    kmStart,
    kmNow: current.km,
    kmDriven,
    kmPerMonth: kmPerMonth !== null ? Math.round(kmPerMonth) : null,
    totalCents,
    serviceCents: sum(services),
    accessoryCents: sum(accessories),
    costPerKmCents: kmDriven > 0 && totalCents > 0 ? Math.round(totalCents / kmDriven) : null,
    records: records.length,
    services: services.length,
    accessories: accessories.length,
    odometerUpdates: records.filter((r) => r.kind === 'odometer').length,
    oilChanges: oil.length,
    lastOilChange: oil[0] ? { date: oil[0].date, km: oil[0].odometer } : null,
    firstService: serviceDates.first,
    lastService: serviceDates.last,
    firstAccessory: accessoryDates.first,
    lastAccessory: accessoryDates.last,
    byGroup: [...groups.values()].sort((a, b) => b.cents - a.cents),
    serviceGroups,
    accessoryTags,
  };
}
