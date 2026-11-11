/// <reference types="jest" />
/// <reference types="node" />
import { DEFAULT_NOTIFICATION_PREFS, planNotifications } from '../notification-plan';
import { computeDue, type ScheduleContext, type UpcomingItem } from '../schedule';

const ctx: ScheduleContext = { today: '2026-06-01', currentKm: 50_000, dailyKm: null, warnKm: 1000, soonDays: 30 };
const vehicles = [{ id: 'v1', label: 'Cronos', lastReadingDate: null }];
const now = new Date(2026, 5, 1, 8, 0); // 2026-06-01 08:00 local

function item(dueDate: string | null, dueKm: number | null = null, c = ctx): UpcomingItem {
  return {
    key: 'svc:v1:motor.aceite',
    source: 'service',
    vehicleId: 'v1',
    title: 'Cambio de aceite',
    item: 'motor.aceite',
    due: computeDue({ dueDate, dueKm, startDate: '2025-06-01', startKm: 40_000 }, c),
  };
}

const days = (plan: ReturnType<typeof planNotifications>) =>
  plan.map((p) => `${p.kind}@${p.date.getFullYear()}-${String(p.date.getMonth() + 1).padStart(2, '0')}-${String(p.date.getDate()).padStart(2, '0')}`);

describe('planNotifications', () => {
  it('schedules the 4 moments: month start, week start (Monday), day before, same day', () => {
    // 2026-08-20 is a Thursday → week starts Monday 2026-08-17
    const plan = planNotifications([item('2026-08-20')], vehicles, { ...DEFAULT_NOTIFICATION_PREFS, odometerNudgeDays: 0 }, now);
    expect(days(plan)).toEqual(['month@2026-08-01', 'week@2026-08-17', 'dayBefore@2026-08-19', 'sameDay@2026-08-20']);
    expect(plan.every((p) => p.date.getHours() === 9)).toBe(true);
  });

  it('collapses moments that land on the same day into the most specific one', () => {
    // 2026-09-01 is a Tuesday: month start == same day; week start is Monday Aug 31 == day before
    const plan = planNotifications([item('2026-09-01')], vehicles, { ...DEFAULT_NOTIFICATION_PREFS, odometerNudgeDays: 0 }, now);
    expect(days(plan)).toEqual(['dayBefore@2026-08-31', 'sameDay@2026-09-01']);
  });

  it('skips moments already in the past', () => {
    // due 2026-06-03 (Wed): month start (Jun 1 09:00) is after "now" (08:00) so it stays; week start Jun 1 collapses into it
    const plan = planNotifications([item('2026-06-03')], vehicles, { ...DEFAULT_NOTIFICATION_PREFS, odometerNudgeDays: 0 }, now);
    expect(days(plan)).toEqual(['week@2026-06-01', 'dayBefore@2026-06-02', 'sameDay@2026-06-03']);
    const later = planNotifications([item('2026-06-03')], vehicles, { ...DEFAULT_NOTIFICATION_PREFS, odometerNudgeDays: 0 }, new Date(2026, 5, 1, 10, 0));
    expect(days(later)).toEqual(['dayBefore@2026-06-02', 'sameDay@2026-06-03']);
  });

  it('respects disabled moments', () => {
    const prefs = { ...DEFAULT_NOTIFICATION_PREFS, month: false, week: false, odometerNudgeDays: 0 };
    expect(days(planNotifications([item('2026-08-20')], vehicles, prefs, now))).toEqual(['dayBefore@2026-08-19', 'sameDay@2026-08-20']);
  });

  it('adds the estimated "less than 1.000 km" alert', () => {
    const c = { ...ctx, dailyKm: 50 };
    const it = item('2027-06-01', 54_000, c); // 4.000 km left → warning in 60 days
    const plan = planNotifications([it], vehicles, { ...DEFAULT_NOTIFICATION_PREFS, odometerNudgeDays: 0 }, now);
    expect(days(plan)).toContain('km@2026-07-31');
    expect(plan.find((p) => p.kind === 'km')!.title).toMatch(/1\.000 km/);
  });

  it('does not schedule date moments for overdue items', () => {
    expect(planNotifications([item('2026-05-01')], vehicles, { ...DEFAULT_NOTIFICATION_PREFS, odometerNudgeDays: 0 }, now)).toEqual([]);
  });

  it('nudges to update the odometer after N days without readings', () => {
    const plan = planNotifications([], [{ id: 'v1', label: 'Cronos', lastReadingDate: '2026-05-20' }], DEFAULT_NOTIFICATION_PREFS, now);
    expect(days(plan)).toEqual(['odometer@2026-06-19']);
    const overdue = planNotifications([], [{ id: 'v1', label: 'Cronos', lastReadingDate: '2026-01-01' }], DEFAULT_NOTIFICATION_PREFS, now);
    expect(days(overdue)).toEqual(['odometer@2026-06-02']);
  });

  it('produces stable unique ids', () => {
    const plan = planNotifications([item('2026-08-20')], vehicles, DEFAULT_NOTIFICATION_PREFS, now);
    expect(new Set(plan.map((p) => p.id)).size).toBe(plan.length);
  });
});
