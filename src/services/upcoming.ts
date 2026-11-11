import { getLatestItemOccurrences, getOdometerReadings } from '@/db/records';
import { getServiceRules, listManualReminders } from '@/db/reminders';
import type { Vehicle } from '@/db/types';
import { listVehicles } from '@/db/vehicles';
import { CORE_ITEM } from '@/domain/maintenance';
import {
  buildEstimatedItems,
  buildManualItems,
  buildServiceItems,
  currentOdometer,
  estimateDailyKm,
  sortUpcoming,
  type Reading,
  type ScheduleContext,
  type UpcomingItem,
} from '@/domain/schedule';
import { today as todayFn } from '@/lib/dates';

export interface VehicleSnapshot {
  vehicle: Vehicle;
  currentKm: number;
  dailyKm: number | null;
  lastReadingDate: string | null;
  /** True when the vehicle has never logged an oil change: its service is an estimate. */
  needsBaseline: boolean;
  ctx: ScheduleContext;
}

export interface UpcomingResult {
  items: UpcomingItem[];
  snapshots: Map<string, VehicleSnapshot>;
}

export async function loadUpcoming(opts: { vehicleId?: string; warnKm?: number; now?: Date } = {}): Promise<UpcomingResult> {
  const now = opts.now ?? new Date();
  const today = todayFn(now);
  const warnKm = opts.warnKm ?? 1000;
  const vehicles = (await listVehicles()).filter((v) => !opts.vehicleId || v.id === opts.vehicleId);
  const snapshots = new Map<string, VehicleSnapshot>();
  const items: UpcomingItem[] = [];

  for (const vehicle of vehicles) {
    const [readingsRaw, occurrences, rules] = await Promise.all([
      getOdometerReadings(vehicle.id),
      getLatestItemOccurrences(vehicle.id),
      getServiceRules(vehicle.id),
    ]);
    // the odometer entered when the vehicle was created is the first reading
    const readings: Reading[] = [{ date: vehicle.createdAt.slice(0, 10), km: vehicle.initialOdometer }, ...readingsRaw];
    const currentKm = currentOdometer(vehicle.initialOdometer, readingsRaw);
    const dailyKm = estimateDailyKm(readings, today);
    const ctx: ScheduleContext = { today, currentKm, dailyKm, warnKm, soonDays: 30 };
    const lastReadingDate = readings.reduce<string | null>((m, r) => (!m || r.date > m ? r.date : m), null);
    snapshots.set(vehicle.id, {
      vehicle,
      currentKm,
      dailyKm,
      lastReadingDate,
      needsBaseline: !occurrences.some((o) => o.item === CORE_ITEM),
      ctx,
    });
    items.push(...buildServiceItems(vehicle.id, occurrences, rules, ctx));
    // the regular service is always scheduled, even before the first one is logged
    items.push(...buildEstimatedItems(vehicle.id, occurrences, rules, ctx, vehicle.createdAt.slice(0, 10)));
  }

  const reminders = await listManualReminders({ vehicleId: opts.vehicleId });
  items.push(
    ...buildManualItems(
      reminders.filter((r) => snapshots.has(r.vehicleId)),
      (id) => snapshots.get(id)!.ctx,
    ),
  );

  return { items: sortUpcoming(items), snapshots };
}

export function vehicleLabel(v: Pick<Vehicle, 'nickname' | 'brand' | 'model'>): string {
  return v.nickname?.trim() || `${v.brand} ${v.model}`.trim();
}
