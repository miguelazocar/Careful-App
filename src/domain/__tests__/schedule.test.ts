/// <reference types="jest" />
/// <reference types="node" />
import {
  buildEstimatedItems,
  buildManualItems,
  buildServiceItems,
  computeDue,
  currentOdometer,
  estimateDailyKm,
  resolveInterval,
  sortUpcoming,
  validateOdometer,
  type ScheduleContext,
} from '../schedule';

const ctx = (over: Partial<ScheduleContext> = {}): ScheduleContext => ({
  today: '2026-06-01',
  currentKm: 50_000,
  dailyKm: 40,
  warnKm: 1000,
  soonDays: 30,
  ...over,
});

describe('odometer', () => {
  it('current odometer is the max reading, never lower than the initial value', () => {
    expect(currentOdometer(10_000, [])).toBe(10_000);
    expect(currentOdometer(10_000, [{ date: '2026-01-01', km: 12_000 }, { date: '2026-02-01', km: 11_000 }])).toBe(12_000);
  });

  it('estimates daily usage from the history', () => {
    const readings = [
      { date: '2026-01-01', km: 10_000 },
      { date: '2026-01-31', km: 11_200 },
    ];
    expect(estimateDailyKm(readings, '2026-02-10')).toBeCloseTo(40);
  });

  it('needs at least two readings spanning 14 days', () => {
    expect(estimateDailyKm([{ date: '2026-01-01', km: 1 }], '2026-02-01')).toBeNull();
    expect(estimateDailyKm([{ date: '2026-01-01', km: 1 }, { date: '2026-01-05', km: 500 }], '2026-02-01')).toBeNull();
  });

  it('ignores future readings and caps absurd rates', () => {
    const r = [
      { date: '2026-01-01', km: 0 },
      { date: '2026-01-31', km: 200_000 },
    ];
    expect(estimateDailyKm(r, '2026-02-01')).toBe(1500);
    expect(estimateDailyKm([{ date: '2026-01-01', km: 0 }, { date: '2026-03-01', km: 9_000 }], '2026-02-01')).toBeNull();
  });

  it('flags readings that go backwards or jump over later ones', () => {
    const readings = [
      { date: '2026-01-10', km: 20_000 },
      { date: '2026-03-10', km: 25_000 },
    ];
    expect(validateOdometer(21_000, '2026-02-01', readings, 0)).toBeNull();
    expect(validateOdometer(19_000, '2026-02-01', readings, 0)).toMatch(/menor/);
    expect(validateOdometer(26_000, '2026-02-01', readings, 0)).toMatch(/mayor/);
    expect(validateOdometer(500, '2026-02-01', [], 1_000)).toMatch(/menor/);
  });
});

describe('computeDue — whichever comes first', () => {
  it('uses the date when it comes before the estimated km date', () => {
    const d = computeDue({ dueDate: '2026-08-01', dueKm: 60_000, startDate: '2025-08-01', startKm: 50_000 }, ctx());
    // 10.000 km at 40 km/day → 250 days → 2027-02-06; the date (August) wins
    expect(d.effectiveDate).toBe('2026-08-01');
    expect(d.trigger).toBe('date');
    expect(d.kmDate).toBe('2027-02-06');
    expect(d.status).toBe('ok');
  });

  it('uses the estimated km date when the car is driven a lot', () => {
    const d = computeDue({ dueDate: '2027-06-01', dueKm: 52_000, startDate: '2026-06-01', startKm: 42_000 }, ctx({ dailyKm: 100 }));
    expect(d.kmDate).toBe('2026-06-21');
    expect(d.effectiveDate).toBe('2026-06-21');
    expect(d.trigger).toBe('km');
    expect(d.status).toBe('soon');
  });

  it('is "soon" when the date is within 30 days', () => {
    expect(computeDue({ dueDate: '2026-07-01', dueKm: null }, ctx()).status).toBe('soon');
  });

  it('is "soon" when fewer than warnKm remain', () => {
    const d = computeDue({ dueDate: null, dueKm: 50_800, startKm: 40_800 }, ctx({ dailyKm: null }));
    expect(d.remainingKm).toBe(800);
    expect(d.status).toBe('soon');
    expect(d.kmDate).toBeNull();
  });

  it('is overdue when the date passed or the km were exceeded', () => {
    expect(computeDue({ dueDate: '2026-05-31', dueKm: null }, ctx()).status).toBe('overdue');
    expect(computeDue({ dueDate: null, dueKm: 49_000 }, ctx()).status).toBe('overdue');
    expect(computeDue({ dueDate: '2026-06-01', dueKm: null }, ctx()).status).toBe('soon'); // due today
  });

  it('computes the km-warning date for the distance alert', () => {
    const d = computeDue({ dueDate: null, dueKm: 54_000, startKm: 44_000 }, ctx({ dailyKm: 50 }));
    // 3.000 km until "1.000 km left" → 60 days
    expect(d.kmWarningDate).toBe('2026-07-31');
  });

  it('reports interval progress', () => {
    const d = computeDue({ dueDate: '2027-06-01', dueKm: 60_000, startDate: '2025-06-01', startKm: 40_000 }, ctx());
    expect(d.progress).toBeCloseTo(0.5, 1);
  });
});

describe('service items', () => {
  const occ = [
    { item: 'motor.aceite', category: 'motor', date: '2026-01-15', odometer: 45_000, recordId: 'r1' },
    { item: 'motor.filtro_aceite', category: 'motor', date: '2026-01-15', odometer: 45_000, recordId: 'r1' },
    { item: 'motor.otro', category: 'motor', date: '2026-01-15', odometer: 45_000, recordId: 'r1' },
  ];

  it('creates one upcoming item per trackable item (oil change: 10.000 km / 12 months)', () => {
    const items = buildServiceItems('v1', occ, [], ctx());
    expect(items).toHaveLength(1);
    expect(items[0].item).toBe('motor.aceite');
    expect(items[0].due.dueKm).toBe(55_000);
    expect(items[0].due.dueDate).toBe('2027-01-15');
  });

  it('honours per-vehicle overrides and disabled rules', () => {
    const custom = buildServiceItems('v1', occ, [{ vehicleId: 'v1', item: 'motor.aceite', intervalKm: 5_000, intervalMonths: 6, enabled: true }], ctx());
    expect(custom[0].due.dueKm).toBe(50_000);
    expect(custom[0].due.dueDate).toBe('2026-07-15');
    const off = buildServiceItems('v1', occ, [{ vehicleId: 'v1', item: 'motor.aceite', intervalKm: 5_000, intervalMonths: 6, enabled: false }], ctx());
    expect(off).toHaveLength(0);
  });

  it('a rule can make a non-default item trackable', () => {
    const items = buildServiceItems('v1', [{ item: 'electrico.bateria', category: 'electrico', date: '2026-01-01', odometer: null, recordId: 'r' }], [{ vehicleId: 'v1', item: 'electrico.bateria', intervalKm: null, intervalMonths: 36, enabled: true }], ctx());
    expect(items[0].due.dueDate).toBe('2029-01-01');
  });

  it('without odometer, a km-only interval cannot be scheduled', () => {
    expect(resolveInterval('ruedas.alineacion_balanceo', []).intervalKm).toBe(10_000);
    const items = buildServiceItems('v1', [{ item: 'tren_delantero.rotulas', category: 'tren_delantero', date: '2026-01-01', odometer: null, recordId: 'r' }], [], ctx());
    expect(items).toHaveLength(0);
  });

  it('manual reminders are included until done, and sorting puts overdue first', () => {
    const manual = buildManualItems(
      [
        { id: 'a', vehicleId: 'v1', title: 'VTV', notes: null, dueDate: '2026-05-01', dueOdometer: null, doneAt: null, createdAt: '2026-01-01T00:00:00Z', updatedAt: '' },
        { id: 'b', vehicleId: 'v1', title: 'Seguro', notes: null, dueDate: '2026-09-01', dueOdometer: null, doneAt: null, createdAt: '2026-01-01T00:00:00Z', updatedAt: '' },
        { id: 'c', vehicleId: 'v1', title: 'Hecho', notes: null, dueDate: '2026-09-01', dueOdometer: null, doneAt: '2026-02-01', createdAt: '2026-01-01T00:00:00Z', updatedAt: '' },
      ],
      () => ctx(),
    );
    expect(manual.map((m) => m.title)).toEqual(['VTV', 'Seguro']);
    const sorted = sortUpcoming([...buildServiceItems('v1', occ, [], ctx()), ...manual]);
    expect(sorted[0].title).toBe('VTV');
    expect(sorted[0].due.status).toBe('overdue');
  });
});

describe('buildEstimatedItems (service without history)', () => {
  const since = '2026-05-01';

  it('schedules the oil change at the next km milestone or one year after the vehicle was added', () => {
    const [it] = buildEstimatedItems('v1', [], [], ctx({ currentKm: 49_200 }), since);
    expect(it).toMatchObject({ key: 'svc:v1:motor.aceite', item: 'motor.aceite', title: 'Cambio de aceite', estimated: true });
    expect(it.due.dueKm).toBe(50_000);
    expect(it.due.remainingKm).toBe(800);
    expect(it.due.dueDate).toBe('2027-05-01');
    expect(it.due.status).toBe('soon');
  });

  it('a brand-new car gets its first service at the first interval', () => {
    const [it] = buildEstimatedItems('v1', [], [], ctx({ currentKm: 0, dailyKm: null }), since);
    expect(it.due.dueKm).toBe(10_000);
    expect(it.due.status).toBe('ok');
  });

  it('exactly on a milestone, the next one is scheduled', () => {
    expect(buildEstimatedItems('v1', [], [], ctx({ currentKm: 60_000 }), since)[0].due.dueKm).toBe(70_000);
  });

  it('disappears once the real service is logged, and respects a disabled or custom interval', () => {
    const logged = [{ item: 'motor.aceite', category: 'motor', date: '2026-04-01', odometer: 48_000, recordId: 'r1' }];
    expect(buildEstimatedItems('v1', logged, [], ctx(), since)).toEqual([]);
    const off = [{ vehicleId: 'v1', item: 'motor.aceite', intervalKm: 10_000, intervalMonths: 12, enabled: false }];
    expect(buildEstimatedItems('v1', [], off as never, ctx(), since)).toEqual([]);
    const custom = [{ vehicleId: 'v1', item: 'motor.aceite', intervalKm: 15_000, intervalMonths: null, enabled: true }];
    const [it] = buildEstimatedItems('v1', [], custom as never, ctx({ currentKm: 31_000 }), since);
    expect(it.due.dueKm).toBe(45_000);
    expect(it.due.dueDate).toBeNull();
  });
});
