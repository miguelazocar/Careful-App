import { newId, nowIso } from '@/lib/id';

import { getDb, notifyDataChanged } from './connection';
import type { LogRecord, LogRecordFull, RecordItem, RecordKind, RecordPhoto, SqlParam } from './types';

interface RecordRow {
  id: string;
  vehicle_id: string;
  kind: RecordKind;
  date: string;
  odometer: number | null;
  amount_cents: number | null;
  workshop: string | null;
  description: string | null;
  created_at: string;
  updated_at: string;
}

interface ItemRow {
  id: string;
  record_id: string;
  category: string;
  item: string;
  label: string;
}

interface PhotoRow {
  id: string;
  record_id: string;
  path: string;
  sort_order: number;
}

export interface RecordInput {
  vehicleId: string;
  kind: RecordKind;
  date: string;
  odometer: number | null;
  amountCents: number | null;
  workshop: string | null;
  description: string | null;
  items: { category: string; item: string; label: string }[];
  /** Relative photo paths, in display order. */
  photos: string[];
}

const mapRecord = (r: RecordRow): LogRecord => ({
  id: r.id,
  vehicleId: r.vehicle_id,
  kind: r.kind,
  date: r.date,
  odometer: r.odometer,
  amountCents: r.amount_cents,
  workshop: r.workshop,
  description: r.description,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

const mapItem = (r: ItemRow): RecordItem => ({
  id: r.id,
  recordId: r.record_id,
  category: r.category,
  item: r.item,
  label: r.label,
});

const mapPhoto = (r: PhotoRow): RecordPhoto => ({
  id: r.id,
  recordId: r.record_id,
  path: r.path,
  sortOrder: r.sort_order,
});

async function hydrate(rows: RecordRow[]): Promise<LogRecordFull[]> {
  if (!rows.length) return [];
  const db = getDb();
  const ids = rows.map((r) => r.id);
  const placeholders = ids.map(() => '?').join(', ');
  const [items, photos] = await Promise.all([
    db.getAllAsync<ItemRow>(`SELECT * FROM record_items WHERE record_id IN (${placeholders})`, ids),
    db.getAllAsync<PhotoRow>(
      `SELECT * FROM record_photos WHERE record_id IN (${placeholders}) ORDER BY sort_order ASC`,
      ids,
    ),
  ]);
  const itemsBy = new Map<string, RecordItem[]>();
  for (const i of items) {
    const list = itemsBy.get(i.record_id) ?? [];
    list.push(mapItem(i));
    itemsBy.set(i.record_id, list);
  }
  const photosBy = new Map<string, RecordPhoto[]>();
  for (const p of photos) {
    const list = photosBy.get(p.record_id) ?? [];
    list.push(mapPhoto(p));
    photosBy.set(p.record_id, list);
  }
  return rows.map((r) => ({
    ...mapRecord(r),
    items: itemsBy.get(r.id) ?? [],
    photos: photosBy.get(r.id) ?? [],
  }));
}

export interface RecordQuery {
  vehicleId?: string | null;
  kinds?: RecordKind[];
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}

export async function listRecords(q: RecordQuery = {}): Promise<LogRecordFull[]> {
  const where: string[] = [];
  const params: SqlParam[] = [];
  if (q.vehicleId) {
    where.push('vehicle_id = ?');
    params.push(q.vehicleId);
  }
  if (q.kinds?.length) {
    where.push(`kind IN (${q.kinds.map(() => '?').join(', ')})`);
    params.push(...q.kinds);
  }
  if (q.from) {
    where.push('date >= ?');
    params.push(q.from);
  }
  if (q.to) {
    where.push('date <= ?');
    params.push(q.to);
  }
  const sql = `SELECT * FROM records ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY date DESC, created_at DESC
    ${q.limit ? `LIMIT ${Math.floor(q.limit)} OFFSET ${Math.floor(q.offset ?? 0)}` : ''}`;
  const rows = await getDb().getAllAsync<RecordRow>(sql, params);
  return hydrate(rows);
}

export async function getRecord(id: string): Promise<LogRecordFull | null> {
  const row = await getDb().getFirstAsync<RecordRow>('SELECT * FROM records WHERE id = ?', [id]);
  if (!row) return null;
  const [full] = await hydrate([row]);
  return full;
}

async function writeChildren(recordId: string, input: RecordInput): Promise<void> {
  const db = getDb();
  for (const it of input.items) {
    await db.runAsync('INSERT INTO record_items (id, record_id, category, item, label) VALUES (?, ?, ?, ?, ?)', [
      newId(),
      recordId,
      it.category,
      it.item,
      it.label,
    ]);
  }
  for (let i = 0; i < input.photos.length; i++) {
    await db.runAsync('INSERT INTO record_photos (id, record_id, path, sort_order) VALUES (?, ?, ?, ?)', [
      newId(),
      recordId,
      input.photos[i],
      i,
    ]);
  }
}

export async function createRecord(input: RecordInput): Promise<LogRecordFull> {
  const db = getDb();
  const id = newId();
  const now = nowIso();
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT INTO records (id, vehicle_id, kind, date, odometer, amount_cents, workshop, description, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        input.vehicleId,
        input.kind,
        input.date,
        input.odometer,
        input.amountCents,
        input.workshop,
        input.description,
        now,
        now,
      ],
    );
    await writeChildren(id, input);
  });
  notifyDataChanged();
  return (await getRecord(id))!;
}

/** Replaces the record and its children. Returns photo paths that are no longer referenced. */
export async function updateRecord(id: string, input: RecordInput): Promise<{ record: LogRecordFull; removedPhotos: string[] }> {
  const db = getDb();
  const before = await getRecord(id);
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `UPDATE records SET vehicle_id = ?, kind = ?, date = ?, odometer = ?, amount_cents = ?, workshop = ?,
       description = ?, updated_at = ? WHERE id = ?`,
      [
        input.vehicleId,
        input.kind,
        input.date,
        input.odometer,
        input.amountCents,
        input.workshop,
        input.description,
        nowIso(),
        id,
      ],
    );
    await db.runAsync('DELETE FROM record_items WHERE record_id = ?', [id]);
    await db.runAsync('DELETE FROM record_photos WHERE record_id = ?', [id]);
    await writeChildren(id, input);
  });
  notifyDataChanged();
  const removedPhotos = (before?.photos ?? []).map((p) => p.path).filter((p) => !input.photos.includes(p));
  return { record: (await getRecord(id))!, removedPhotos };
}

/** Returns photo paths so the caller can delete the files. */
export async function deleteRecord(id: string): Promise<string[]> {
  const db = getDb();
  const photos = await db.getAllAsync<{ path: string }>('SELECT path FROM record_photos WHERE record_id = ?', [id]);
  await db.runAsync('DELETE FROM records WHERE id = ?', [id]);
  notifyDataChanged();
  return photos.map((p) => p.path);
}

/* ------------------------------------------------------------------ */
/* Aggregates used by the reminder engine and dashboards               */
/* ------------------------------------------------------------------ */

export interface OdometerReading {
  date: string;
  km: number;
}

export async function getOdometerReadings(vehicleId: string): Promise<OdometerReading[]> {
  const rows = await getDb().getAllAsync<{ date: string; km: number }>(
    `SELECT date, odometer AS km FROM records WHERE vehicle_id = ? AND odometer IS NOT NULL
     ORDER BY date ASC, odometer ASC`,
    [vehicleId],
  );
  return rows;
}

export interface ItemOccurrence {
  item: string;
  category: string;
  date: string;
  odometer: number | null;
  recordId: string;
}

/** Latest occurrence of every item for a vehicle (the baseline for service intervals). */
export async function getLatestItemOccurrences(vehicleId: string): Promise<ItemOccurrence[]> {
  return getDb().getAllAsync<ItemOccurrence>(
    `SELECT i.item AS item, i.category AS category, r.date AS date, r.odometer AS odometer, r.id AS recordId
     FROM record_items i
     JOIN records r ON r.id = i.record_id
     WHERE r.vehicle_id = ?
       AND r.rowid = (
         SELECT r2.rowid FROM record_items i2 JOIN records r2 ON r2.id = i2.record_id
         WHERE r2.vehicle_id = r.vehicle_id AND i2.item = i.item
         ORDER BY r2.date DESC, COALESCE(r2.odometer, 0) DESC, r2.created_at DESC LIMIT 1
       )
     GROUP BY i.item`,
    [vehicleId],
  );
}

export interface VehicleStats {
  vehicleId: string;
  recordCount: number;
  totalCents: number;
  yearCents: number;
  lastDate: string | null;
  maxOdometer: number | null;
}

export async function getVehicleStats(year: number): Promise<VehicleStats[]> {
  return getDb().getAllAsync<VehicleStats>(
    `SELECT v.id AS vehicleId,
            COUNT(r.id) AS recordCount,
            COALESCE(SUM(r.amount_cents), 0) AS totalCents,
            COALESCE(SUM(CASE WHEN substr(r.date, 1, 4) = ? THEN r.amount_cents END), 0) AS yearCents,
            MAX(r.date) AS lastDate,
            MAX(r.odometer) AS maxOdometer
     FROM vehicles v LEFT JOIN records r ON r.vehicle_id = v.id
     GROUP BY v.id`,
    [String(year)],
  );
}

export interface MonthlySpend {
  month: string; // YYYY-MM
  cents: number;
  count: number;
}

export async function getMonthlySpend(from: string, vehicleId?: string | null): Promise<MonthlySpend[]> {
  const params: SqlParam[] = [from];
  if (vehicleId) params.push(vehicleId);
  return getDb().getAllAsync<MonthlySpend>(
    `SELECT substr(date, 1, 7) AS month, COALESCE(SUM(amount_cents), 0) AS cents, COUNT(*) AS count
     FROM records WHERE date >= ? ${vehicleId ? 'AND vehicle_id = ?' : ''}
     GROUP BY month ORDER BY month ASC`,
    params,
  );
}
