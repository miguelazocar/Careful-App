/// <reference types="jest" />
/// <reference types="node" />
import { DEFAULT_NOTIFICATION_PREFS, dueText, planNotifications, WEEKS_AHEAD } from '../notification-plan';
import { computeDue, type ScheduleContext, type UpcomingItem } from '../schedule';

const ctx: ScheduleContext = { today: '2026-06-01', currentKm: 50_000, dailyKm: null, warnKm: 1000, soonDays: 30 };
const vehicles = [{ id: 'v1', label: 'Cronos', lastReadingDate: null }];
const now = new Date(2026, 5, 1, 8, 0); // Monday 2026-06-01 08:00 local
const prefs = { ...DEFAULT_NOTIFICATION_PREFS, odometerNudgeDays: 0 };

function item(dueDate: string | null, dueKm: number | null = null, c = ctx, lastDate = '2025-06-01'): UpcomingItem {
  return {
    key: 'svc:v1:motor.aceite',
    source: 'service',
    vehicleId: 'v1',
    title: 'Cambio de aceite',
    item: 'motor.aceite',
    lastDate,
    due: computeDue({ dueDate, dueKm, startDate: lastDate, startKm: 40_000 }, c),
  };
}

const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const days = (plan: ReturnType<typeof planNotifications>) => plan.map((p) => `${p.kind}@${fmt(p.date)}`);

describe('planNotifications', () => {
  it('reminds every week from one month before the date, then "Mañana" and "Hoy", and keeps going once overdue', () => {
    // due Thursday 2026-08-20 → weekly on Thursdays from Jul 20 on
    const plan = planNotifications([item('2026-08-20')], vehicles, prefs, now);
    expect(days(plan)).toEqual([
      'weekly@2026-07-23',
      'weekly@2026-07-30',
      'weekly@2026-08-06',
      'weekly@2026-08-13',
      'dayBefore@2026-08-19',
      'sameDay@2026-08-20',
      'weekly@2026-08-27',
      'weekly@2026-09-03',
      'weekly@2026-09-10',
    ]);
    expect(plan.every((p) => p.date.getHours() === 9)).toBe(true);
    expect(plan[0].title).toBe('Se acerca: Cambio de aceite');
    expect(plan[plan.length - 1].title).toBe('Vencido: Cambio de aceite');
  });

  it('starts earlier when fewer than 1.000 km will remain before that month', () => {
    const c = { ...ctx, dailyKm: 50 };
    // 4.000 km left at 50 km/day → 1.000 km left on 2026-07-31; due date far away (2027-06-01, a Tuesday)
    const plan = planNotifications([item('2027-06-01', 54_000, c)], vehicles, prefs, now);
    expect(days(plan)[0]).toBe('weekly@2026-08-04');
    expect(plan[0].body).toBe('Cronos · a los 54.000 km o el 1 jun 2027 (lo que ocurra primero)');
    expect(plan.filter((p) => p.kind === 'weekly')).toHaveLength(WEEKS_AHEAD);
  });

  it('starts right away when the last reading already leaves fewer than 1.000 km', () => {
    // km-only service, 500 km left; cadence anchored to the last service (Saturday 2026-01-10)
    const plan = planNotifications([item(null, 50_500, ctx, '2026-01-10')], vehicles, prefs, now);
    expect(days(plan)[0]).toBe('weekly@2026-06-06');
    expect(plan[0].title).toMatch(/^Se acerca/);
  });

  it('an overdue service is reminded weekly until it is logged', () => {
    const plan = planNotifications([item('2026-05-01')], vehicles, prefs, now);
    expect(days(plan).slice(0, 2)).toEqual(['weekly@2026-06-05', 'weekly@2026-06-12']);
    expect(plan.every((p) => p.title.startsWith('Vencido'))).toBe(true);
  });

  it('the cadence does not move when the plan is rebuilt on other days', () => {
    const a = planNotifications([item('2026-08-20')], vehicles, prefs, new Date(2026, 6, 21, 10, 0));
    const b = planNotifications([item('2026-08-20')], vehicles, prefs, new Date(2026, 6, 22, 10, 0));
    expect(days(a)[0]).toBe('weekly@2026-07-23');
    expect(days(b)[0]).toBe('weekly@2026-07-23');
  });

  it('skips moments already in the past', () => {
    const at10 = planNotifications([item('2026-08-20')], vehicles, prefs, new Date(2026, 6, 23, 10, 0));
    expect(days(at10)[0]).toBe('weekly@2026-07-30');
  });

  it('respects disabled moments', () => {
    const p = { ...prefs, weekly: false };
    expect(days(planNotifications([item('2026-08-20')], vehicles, p, now))).toEqual(['dayBefore@2026-08-19', 'sameDay@2026-08-20']);
  });

  it('ignores km when the km alert is off', () => {
    const c = { ...ctx, dailyKm: 50 };
    const plan = planNotifications([item('2027-06-01', 54_000, c)], vehicles, { ...prefs, kmAlert: false }, now);
    expect(days(plan)[0]).toBe('weekly@2027-05-04');
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

  it('describes the due point', () => {
    expect(dueText(item(null, 55_000).due)).toBe('a los 55.000 km');
    expect(dueText(item('2026-08-20').due)).toBe('el 20 ago 2026');
  });
});
