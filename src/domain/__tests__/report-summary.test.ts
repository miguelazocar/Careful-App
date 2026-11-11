/// <reference types="jest" />
import type { LogRecordFull, RecordKind } from '@/db/types';

import { summarizeHistory } from '../report-summary';

let n = 0;
function rec(kind: RecordKind, date: string, km: number | null, cents: number | null, items: [string, string][] = []): LogRecordFull {
  const id = `r${++n}`;
  return {
    id,
    vehicleId: 'v',
    kind,
    date,
    odometer: km,
    amountCents: cents,
    workshop: null,
    description: null,
    createdAt: `${date}T10:00:00.000Z`,
    updatedAt: `${date}T10:00:00.000Z`,
    items: items.map(([category, item]) => ({ id: `${id}-${item}`, recordId: id, category, item, label: item, intervalKm: null, intervalMonths: null })),
    photos: [],
  };
}

describe('summarizeHistory', () => {
  const vehicle = { createdAt: '2025-01-10T12:00:00.000Z', initialOdometer: 40_000 };
  const records = [
    rec('maintenance', '2026-01-15', 52_000, 120_000_00, [['motor', 'motor.aceite'], ['motor', 'motor.filtro_aceite']]),
    rec('accessory', '2025-09-01', 47_000, 80_000_00, [['accesorios', 'accesorios.polarizado']]),
    rec('maintenance', '2025-06-01', 45_000, 30_000_00, [['ruedas', 'ruedas.alineacion_balanceo']]),
    rec('maintenance', '2025-02-01', 41_000, 100_000_00, [['motor', 'motor.aceite']]),
    rec('odometer', '2026-03-01', 55_000, null),
  ];

  it('counts km driven, spending and services since the vehicle was added', () => {
    const s = summarizeHistory(vehicle, records, { km: 55_000, dailyKm: null }, '2026-03-10');
    expect(s.since).toBe('2025-01-10');
    expect(s.months).toBe(13);
    expect(s.kmStart).toBe(40_000);
    expect(s.kmDriven).toBe(15_000);
    expect(s.totalCents).toBe(330_000_00);
    expect(s.serviceCents).toBe(250_000_00);
    expect(s.accessoryCents).toBe(80_000_00);
    expect(s.costPerKmCents).toBe(2_200); // 330.000 / 15.000 km = 22 por km
    expect(s.services).toBe(3);
    expect(s.accessories).toBe(1);
    expect(s.odometerUpdates).toBe(1);
    expect(s.oilChanges).toBe(2);
    expect(s.lastOilChange).toEqual({ date: '2026-01-15', km: 52_000 });
    expect(s.lastService).toBe('2026-01-15');
  });

  it('groups spending by category, biggest first', () => {
    const s = summarizeHistory(vehicle, records, { km: 55_000, dailyKm: null }, '2026-03-10');
    expect(s.byGroup.map((g) => [g.key, g.cents, g.count])).toEqual([
      ['motor', 220_000_00, 2],
      ['accesorios', 80_000_00, 1],
      ['ruedas', 30_000_00, 1],
    ]);
  });

  it('uses the usage estimate for km per month when available', () => {
    expect(summarizeHistory(vehicle, records, { km: 55_000, dailyKm: 40 }, '2026-03-10').kmPerMonth).toBe(1_218);
    expect(summarizeHistory(vehicle, records, { km: 55_000, dailyKm: null }, '2026-03-10').kmPerMonth).toBe(1_077); // 15.000 km in 424 days
  });

  it('starts from an older record when it predates the vehicle', () => {
    const s = summarizeHistory(vehicle, [rec('maintenance', '2024-11-01', 38_500, null, [['motor', 'motor.aceite']])], { km: 40_000, dailyKm: null }, '2025-01-20');
    expect(s.since).toBe('2024-11-01');
    expect(s.kmStart).toBe(38_500);
    expect(s.kmDriven).toBe(1_500);
    expect(s.costPerKmCents).toBeNull();
  });
});
