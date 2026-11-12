/// <reference types="jest" />
/// <reference types="node" />
import { loadUpcoming } from '@/services/upcoming';

import { onDataChanged } from '../connection';
import { migrate, MIGRATIONS } from '../migrations';
import { createRecord, deleteRecord, getAccessoryTagCounts, getLatestItemOccurrences, getMonthlySpend, getOdometerReadings, getVehicleStats, listRecords, updateRecord, type RecordInput } from '../records';
import { createManualReminder, listManualReminders, markNotified, saveServiceRule, setManualReminderDone, wasNotified } from '../reminders';
import { getAllSettings, setSetting } from '../settings';
import { exportSnapshot, importSnapshot, referencedPhotos, validatePayload } from '../snapshot';
import { createVehicle, deleteVehicle, getVehicle, listVehicles, setVehicleArchived, updateVehicle, type VehicleInput } from '../vehicles';
import { createNodeDb, setupTestDb } from './node-db';

const baseVehicle: VehicleInput = {
  nickname: null,
  brand: 'Fiat',
  brandId: 'fiat',
  model: 'Cronos',
  modelId: 'cronos',
  year: 2021,
  variant: '1.3 Drive',
  engineId: null,
  fuel: 'nafta',
  color: 'Blanco',
  colorHex: '#F5F6F8',
  plate: 'AE307KT',
  country: 'AR',
  plateStyle: null,
  vin: null,
  engineNumber: null,
  photo: 'photos/cover.jpg',
  initialOdometer: 40_000,
  oilBase: 'sintetico',
  oilBrand: 'Selenia',
  oilModel: 'K Pure Energy',
  oilType: '5W-30',
  oilLiters: 3.4,
  coolantBase: null,
  coolantBrand: null,
  coolantModel: null,
  coolantType: null,
  coolantLiters: null,
  coolantConcentration: null,
  notes: null,
};

const record = (vehicleId: string, over: Partial<RecordInput> = {}): RecordInput => ({
  vehicleId,
  kind: 'maintenance',
  date: '2026-01-15',
  odometer: 45_000,
  amountCents: 8_500_000,
  workshop: 'Taller Centro',
  description: 'Cambio de aceite y filtro',
  items: [
    { category: 'motor', item: 'motor.aceite', label: 'Cambio de aceite' },
    { category: 'motor', item: 'motor.filtro_aceite', label: 'Filtro de aceite' },
  ],
  photos: ['photos/a.jpg', 'photos/b.jpg'],
  ...over,
});

describe('repositories on real SQLite', () => {
  let db: Awaited<ReturnType<typeof setupTestDb>>;
  beforeEach(async () => {
    db = await setupTestDb();
  });
  afterEach(() => db.close());

  it('migrates idempotently', async () => {
    const v = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
    expect(v?.user_version).toBe(MIGRATIONS.length);
  });

  it('stores the detailed oil and coolant data', async () => {
    const v = await createVehicle({
      ...baseVehicle,
      coolantBase: 'organico',
      coolantBrand: 'Paraflu',
      coolantModel: 'Up',
      coolantType: 'G12+ · rosa',
      coolantLiters: 6,
      coolantConcentration: 40,
    });
    expect(v).toMatchObject({ oilBase: 'sintetico', oilBrand: 'Selenia', oilModel: 'K Pure Energy', coolantBase: 'organico', coolantConcentration: 40, coolantLiters: 6 });
    await updateVehicle(v.id, { coolantConcentration: 50, oilBrand: null });
    expect(await getVehicle(v.id)).toMatchObject({ coolantConcentration: 50, oilBrand: null, oilModel: 'K Pure Energy' });
  });

  it('migration 2 infers oil and coolant bases for existing vehicles', async () => {
    const old = createNodeDb();
    await old.execAsync(MIGRATIONS[0]);
    await old.execAsync('PRAGMA user_version = 1');
    const ins = (id: string, oil: string | null, coolant: string | null) =>
      old.runAsync(
        "INSERT INTO vehicles (id, brand, model, country, initial_odometer, oil_type, coolant_type, sort_order, created_at, updated_at) VALUES (?, 'Fiat', 'Cronos', 'AR', 0, ?, ?, 0, '2026-01-01', '2026-01-01')",
        [id, oil, coolant],
      );
    await ins('a', '5W-30 · ACEA C2', 'Orgánico (OAT) rosa');
    await ins('b', '15W-40', 'HOAT · amarillo');
    await ins('c', '10W-40', 'Inorgánico verde');
    await ins('d', null, 'Paraflu UP');
    await migrate(old);
    const rows = await old.getAllAsync<{ id: string; oil_base: string | null; coolant_base: string | null }>('SELECT id, oil_base, coolant_base FROM vehicles ORDER BY id');
    expect(rows).toEqual([
      { id: 'a', oil_base: 'sintetico', coolant_base: 'organico' },
      { id: 'b', oil_base: 'mineral', coolant_base: 'hibrido' },
      { id: 'c', oil_base: 'semisintetico', coolant_base: 'inorganico' },
      { id: 'd', oil_base: null, coolant_base: null },
    ]);
    old.close();
  });

  it('creates, updates, archives and lists vehicles in order', async () => {
    const a = await createVehicle(baseVehicle);
    const b = await createVehicle({ ...baseVehicle, model: 'Toro', plate: 'AF100AA' });
    expect(a.sortOrder).toBe(0);
    expect(b.sortOrder).toBe(1);
    await updateVehicle(a.id, { nickname: 'El Cronos', initialOdometer: 41_000 });
    expect((await getVehicle(a.id))?.nickname).toBe('El Cronos');
    await setVehicleArchived(b.id, { reason: 'venta', note: '  Vendido a Juan  ' });
    expect((await listVehicles()).map((v) => v.id)).toEqual([a.id]);
    expect(await listVehicles({ includeArchived: true })).toHaveLength(2);
    expect(await getVehicle(b.id)).toMatchObject({ archivedReason: 'venta', archivedNote: 'Vendido a Juan' });
    expect((await getVehicle(b.id))?.archivedAt).toBeTruthy();
  });

  it('restoring an archived vehicle clears its reason; its own agenda still loads, the global one skips it', async () => {
    const a = await createVehicle(baseVehicle);
    const b = await createVehicle({ ...baseVehicle, model: 'Toro', plate: 'AF100AA' });
    await setVehicleArchived(b.id, { reason: 'robo' });
    expect((await loadUpcoming()).snapshots.has(b.id)).toBe(false);
    expect((await loadUpcoming()).snapshots.has(a.id)).toBe(true);
    expect((await loadUpcoming({ vehicleId: b.id })).snapshots.get(b.id)?.vehicle.archivedReason).toBe('robo');
    await setVehicleArchived(b.id, null);
    expect(await getVehicle(b.id)).toMatchObject({ archivedAt: null, archivedReason: null, archivedNote: null });
  });

  it('stores records with items and photos, and notifies listeners', async () => {
    const v = await createVehicle(baseVehicle);
    const spy = jest.fn();
    const off = onDataChanged(spy);
    const r = await createRecord(record(v.id));
    off();
    expect(spy).toHaveBeenCalled();
    expect(r.items.map((i) => i.item)).toEqual(['motor.aceite', 'motor.filtro_aceite']);
    expect(r.photos.map((p) => p.path)).toEqual(['photos/a.jpg', 'photos/b.jpg']);
    const { record: updated, removedPhotos } = await updateRecord(r.id, record(v.id, { photos: ['photos/b.jpg'], amountCents: 100 }));
    expect(updated.amountCents).toBe(100);
    expect(removedPhotos).toEqual(['photos/a.jpg']);
    expect(await deleteRecord(r.id)).toEqual(['photos/b.jpg']);
    expect(await listRecords()).toHaveLength(0);
  });

  it('cascades vehicle deletion and returns every photo to remove', async () => {
    const v = await createVehicle(baseVehicle);
    await createRecord(record(v.id));
    await createManualReminder({ vehicleId: v.id, title: 'VTV', notes: null, dueDate: '2026-12-01', dueOdometer: null });
    await saveServiceRule({ vehicleId: v.id, item: 'motor.aceite', intervalKm: 5000, intervalMonths: 6, enabled: true });
    const photos = await deleteVehicle(v.id);
    expect(photos.sort()).toEqual(['photos/a.jpg', 'photos/b.jpg', 'photos/cover.jpg']);
    for (const t of ['records', 'record_items', 'record_photos', 'reminders', 'service_rules']) {
      const c = await db.getFirstAsync<{ n: number }>(`SELECT COUNT(*) AS n FROM ${t}`);
      expect(c?.n).toBe(0);
    }
  });

  it('finds the latest occurrence of each item (service baseline)', async () => {
    const v = await createVehicle(baseVehicle);
    await createRecord(record(v.id, { date: '2025-06-01', odometer: 35_000 }));
    await createRecord(record(v.id, { date: '2026-01-15', odometer: 45_000 }));
    await createRecord(record(v.id, { date: '2025-12-01', odometer: 44_000, items: [{ category: 'frenos', item: 'frenos.liquido', label: 'Líquido de frenos' }] }));
    const occ = await getLatestItemOccurrences(v.id);
    const oil = occ.find((o) => o.item === 'motor.aceite')!;
    expect(oil.date).toBe('2026-01-15');
    expect(oil.odometer).toBe(45_000);
    expect(occ.find((o) => o.item === 'frenos.liquido')?.date).toBe('2025-12-01');
    expect(occ).toHaveLength(3);
  });

  it('keeps the interval chosen when the service was logged; the newest service rules the schedule', async () => {
    const v = await createVehicle(baseVehicle);
    const oil = (intervalKm: number | null, intervalMonths: number | null) => [{ category: 'motor', item: 'motor.aceite', label: 'Cambio de aceite', intervalKm, intervalMonths }];
    await createRecord(record(v.id, { date: '2025-06-01', odometer: 35_000, items: oil(10_000, 12) }));
    const latest = await createRecord(record(v.id, { date: '2026-01-15', odometer: 45_000, items: oil(7_500, 6) }));
    expect(latest.items[0]).toMatchObject({ intervalKm: 7_500, intervalMonths: 6 });
    const occ = (await getLatestItemOccurrences(v.id)).find((o) => o.item === 'motor.aceite')!;
    expect(occ).toMatchObject({ date: '2026-01-15', odometer: 45_000, intervalKm: 7_500, intervalMonths: 6 });
    const { items } = await loadUpcoming({ vehicleId: v.id, now: new Date(2026, 1, 1) });
    const next = items.find((i) => i.item === 'motor.aceite')!;
    expect(next.due.dueKm).toBe(52_500);
    expect(next.due.dueDate).toBe('2026-07-15');
  });

  it('aggregates odometer readings, stats and monthly spend', async () => {
    const v = await createVehicle(baseVehicle);
    await createRecord(record(v.id, { date: '2026-01-15', odometer: 45_000, amountCents: 1000 }));
    await createRecord(record(v.id, { kind: 'odometer', date: '2026-02-15', odometer: 46_500, amountCents: null, items: [], photos: [] }));
    await createRecord(record(v.id, { date: '2026-02-20', odometer: null, amountCents: 500, items: [], photos: [] }));
    expect((await getOdometerReadings(v.id)).map((r) => r.km)).toEqual([45_000, 46_500]);
    const [stats] = await getVehicleStats(2026);
    expect(stats).toMatchObject({ recordCount: 3, totalCents: 1500, yearCents: 1500, maxOdometer: 46_500 });
    const spend = await getMonthlySpend('2026-01-01');
    expect(spend).toEqual([
      { month: '2026-01', cents: 1000, count: 1 },
      { month: '2026-02', cents: 500, count: 2 },
    ]);
  });

  it('filters accessories by tag and counts the tags in use', async () => {
    const v = await createVehicle(baseVehicle);
    const w = await createVehicle({ ...baseVehicle, plate: 'AA000AA' });
    const accessory = (vehicleId: string, item: string, label: string) =>
      record(vehicleId, { kind: 'accessory', workshop: null, photos: [], items: [{ category: 'accesorios', item, label }] });
    await createRecord(accessory(v.id, 'accesorios.estereo', 'Pioneer con CarPlay'));
    await createRecord(accessory(v.id, 'accesorios.luces', 'LED interiores'));
    await createRecord(accessory(w.id, 'accesorios.luces', 'Faros auxiliares'));
    await createRecord(accessory(w.id, 'accesorios.otro', 'Porta celular'));
    await createRecord(record(v.id));

    const lights = await listRecords({ kinds: ['accessory'], items: ['accesorios.luces'] });
    expect(lights.map((r) => r.items[0].label).sort()).toEqual(['Faros auxiliares', 'LED interiores']);
    expect((await listRecords({ vehicleId: v.id, items: ['accesorios.luces'] })).map((r) => r.items[0].label)).toEqual(['LED interiores']);
    expect(await getAccessoryTagCounts()).toEqual([
      { item: 'accesorios.luces', count: 2 },
      expect.objectContaining({ count: 1 }),
      expect.objectContaining({ count: 1 }),
    ]);
    expect((await getAccessoryTagCounts(w.id)).map((t) => t.item).sort()).toEqual(['accesorios.luces', 'accesorios.otro']);
  });

  it('manual reminders and notification log', async () => {
    const v = await createVehicle(baseVehicle);
    const r = await createManualReminder({ vehicleId: v.id, title: 'Seguro', notes: null, dueDate: '2026-09-01', dueOdometer: null });
    expect(await listManualReminders()).toHaveLength(1);
    await setManualReminderDone(r.id, true);
    expect(await listManualReminders()).toHaveLength(0);
    expect(await listManualReminders({ includeDone: true })).toHaveLength(1);
    expect(await wasNotified('k')).toBe(false);
    await markNotified('k');
    expect(await wasNotified('k')).toBe(true);
  });

  it('loadUpcoming builds the agenda from the database', async () => {
    const v = await createVehicle({ ...baseVehicle, initialOdometer: 40_000 });
    // created "today" by the repo; add history so a daily rate can be estimated
    await createRecord(record(v.id, { date: '2026-01-01', odometer: 45_000 }));
    await createRecord(record(v.id, { kind: 'odometer', date: '2026-03-01', odometer: 47_360, items: [], photos: [], amountCents: null }));
    const { items, snapshots } = await loadUpcoming({ now: new Date(2026, 2, 2) });
    const snap = snapshots.get(v.id)!;
    expect(snap.currentKm).toBe(47_360);
    expect(snap.needsBaseline).toBe(false);
    const oil = items.find((i) => i.item === 'motor.aceite')!;
    expect(oil.due.dueKm).toBe(55_000);
    expect(oil.due.dueDate).toBe('2027-01-01');
    expect(oil.due.remainingKm).toBe(7_640);
  });

  it('backup snapshot round-trips and never carries device-bound settings', async () => {
    const v = await createVehicle(baseVehicle);
    await createRecord(record(v.id));
    await setSetting('theme', 'dark');
    await setSetting('securityMode', 'pin');
    await setSetting('backup', { folderUri: 'content://x' });
    const snap = await exportSnapshot('test');
    expect(() => validatePayload(snap)).not.toThrow();
    expect(snap.tables.settings?.map((s) => s.key)).toEqual(['theme']);
    expect(referencedPhotos(snap).sort()).toEqual(['photos/a.jpg', 'photos/b.jpg', 'photos/cover.jpg']);

    // wipe and restore into a fresh database
    db.close();
    db = await setupTestDb();
    await setSetting('securityMode', 'none');
    const res = await importSnapshot(JSON.parse(JSON.stringify(snap)));
    expect(res).toEqual({ vehicles: 1, records: 1 });
    expect((await listRecords())[0].items).toHaveLength(2);
    const settings = await getAllSettings();
    expect(settings.theme).toBe('dark');
    expect(settings.securityMode).toBe('none'); // local device setting preserved
  });

  it('rejects foreign or newer backups', () => {
    expect(() => validatePayload({ format: 'other' })).toThrow(/no es un respaldo/);
    expect(() => validatePayload({ format: 'careful-backup', version: 99, schemaVersion: 1, tables: { vehicles: [] } })).toThrow(/más nueva/);
  });
});
