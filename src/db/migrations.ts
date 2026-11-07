import type { Db } from './types';

/**
 * Ordered, append-only schema migrations. `PRAGMA user_version` stores the applied count.
 * Never edit a released migration — add a new one.
 */
export const MIGRATIONS: string[] = [
  /* 1 — initial schema */ `
  CREATE TABLE IF NOT EXISTS vehicles (
    id TEXT PRIMARY KEY NOT NULL,
    nickname TEXT,
    brand TEXT NOT NULL,
    brand_id TEXT,
    model TEXT NOT NULL,
    model_id TEXT,
    year INTEGER,
    variant TEXT,
    engine_id TEXT,
    fuel TEXT,
    color TEXT,
    color_hex TEXT,
    plate TEXT,
    country TEXT NOT NULL DEFAULT 'AR',
    vin TEXT,
    engine_number TEXT,
    photo TEXT,
    initial_odometer INTEGER NOT NULL DEFAULT 0,
    oil_type TEXT,
    oil_liters REAL,
    coolant_type TEXT,
    coolant_liters REAL,
    notes TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    archived_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS records (
    id TEXT PRIMARY KEY NOT NULL,
    vehicle_id TEXT NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    kind TEXT NOT NULL CHECK (kind IN ('maintenance', 'accessory', 'odometer')),
    date TEXT NOT NULL,
    odometer INTEGER,
    amount_cents INTEGER,
    workshop TEXT,
    description TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_records_vehicle_date ON records(vehicle_id, date DESC);
  CREATE INDEX IF NOT EXISTS idx_records_date ON records(date DESC);

  CREATE TABLE IF NOT EXISTS record_items (
    id TEXT PRIMARY KEY NOT NULL,
    record_id TEXT NOT NULL REFERENCES records(id) ON DELETE CASCADE,
    category TEXT NOT NULL,
    item TEXT NOT NULL,
    label TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_record_items_record ON record_items(record_id);
  CREATE INDEX IF NOT EXISTS idx_record_items_item ON record_items(item);

  CREATE TABLE IF NOT EXISTS record_photos (
    id TEXT PRIMARY KEY NOT NULL,
    record_id TEXT NOT NULL REFERENCES records(id) ON DELETE CASCADE,
    path TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0
  );
  CREATE INDEX IF NOT EXISTS idx_record_photos_record ON record_photos(record_id);

  CREATE TABLE IF NOT EXISTS service_rules (
    vehicle_id TEXT NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    item TEXT NOT NULL,
    interval_km INTEGER,
    interval_months INTEGER,
    enabled INTEGER NOT NULL DEFAULT 1,
    PRIMARY KEY (vehicle_id, item)
  );

  CREATE TABLE IF NOT EXISTS reminders (
    id TEXT PRIMARY KEY NOT NULL,
    vehicle_id TEXT NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    notes TEXT,
    due_date TEXT,
    due_odometer INTEGER,
    done_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_reminders_vehicle ON reminders(vehicle_id);

  CREATE TABLE IF NOT EXISTS notification_log (
    key TEXT PRIMARY KEY NOT NULL,
    sent_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL
  );
  `,
];

export async function migrate(db: Db): Promise<number> {
  await db.execAsync('PRAGMA foreign_keys = ON;');
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const current = row?.user_version ?? 0;
  for (let i = current; i < MIGRATIONS.length; i++) {
    await db.withTransactionAsync(async () => {
      await db.execAsync(MIGRATIONS[i]);
      await db.execAsync(`PRAGMA user_version = ${i + 1}`);
    });
  }
  return MIGRATIONS.length;
}

/** Tables in dependency order (parents first) — used by backup/restore. */
export const TABLES = [
  'vehicles',
  'records',
  'record_items',
  'record_photos',
  'service_rules',
  'reminders',
  'notification_log',
  'settings',
] as const;
export type TableName = (typeof TABLES)[number];
