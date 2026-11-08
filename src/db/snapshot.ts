/**
 * Whole-database snapshot used by backups. Rows are exported raw (snake_case) so a backup can be
 * restored even after future schema migrations add columns.
 */
import { getDb, notifyDataChanged } from './connection';
import { MIGRATIONS, TABLES, type TableName } from './migrations';
import type { SqlParam } from './types';

export const BACKUP_FORMAT = 'careful-backup';
export const BACKUP_VERSION = 1;

/** Settings that must never travel between devices (they depend on device-bound secrets/paths). */
export const DEVICE_BOUND_SETTINGS = ['securityMode', 'backup', 'drive', 'ai'];

export interface BackupPayload {
  format: typeof BACKUP_FORMAT;
  version: number;
  schemaVersion: number;
  exportedAt: string;
  app: string;
  tables: Partial<Record<TableName, Record<string, SqlParam>[]>>;
}

export async function exportSnapshot(appVersion = 'unknown'): Promise<BackupPayload> {
  const db = getDb();
  const tables: BackupPayload['tables'] = {};
  for (const t of TABLES) {
    let rows = await db.getAllAsync<Record<string, SqlParam>>(`SELECT * FROM ${t}`);
    if (t === 'settings') rows = rows.filter((r) => !DEVICE_BOUND_SETTINGS.includes(String(r.key)));
    tables[t] = rows;
  }
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    schemaVersion: MIGRATIONS.length,
    exportedAt: new Date().toISOString(),
    app: `careful@${appVersion}`,
    tables,
  };
}

export function validatePayload(p: unknown): asserts p is BackupPayload {
  const x = p as Partial<BackupPayload> | null;
  if (!x || x.format !== BACKUP_FORMAT || typeof x.tables !== 'object' || !x.tables) {
    throw new Error('El archivo no es un respaldo de Careful.');
  }
  if ((x.version ?? 0) > BACKUP_VERSION || (x.schemaVersion ?? 0) > MIGRATIONS.length) {
    throw new Error('El respaldo fue creado con una versión más nueva de Careful. Actualizá la app.');
  }
  if (!Array.isArray(x.tables.vehicles)) throw new Error('El respaldo está incompleto (sin vehículos).');
}

/** Replaces all data with the snapshot, inside a single transaction. */
export async function importSnapshot(payload: BackupPayload): Promise<{ vehicles: number; records: number }> {
  validatePayload(payload);
  const db = getDb();
  const columnsOf = new Map<string, Set<string>>();
  for (const t of TABLES) {
    const info = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${t})`);
    columnsOf.set(t, new Set(info.map((c) => c.name)));
  }

  await db.withTransactionAsync(async () => {
    for (const t of [...TABLES].reverse()) {
      if (t === 'settings') {
        await db.runAsync(
          `DELETE FROM settings WHERE key NOT IN (${DEVICE_BOUND_SETTINGS.map(() => '?').join(', ')})`,
          DEVICE_BOUND_SETTINGS,
        );
      } else {
        await db.runAsync(`DELETE FROM ${t}`);
      }
    }
    for (const t of TABLES) {
      const rows = payload.tables[t] ?? [];
      const allowed = columnsOf.get(t)!;
      for (const row of rows) {
        if (t === 'settings' && DEVICE_BOUND_SETTINGS.includes(String(row.key))) continue;
        const cols = Object.keys(row).filter((c) => allowed.has(c));
        if (!cols.length) continue;
        await db.runAsync(
          `INSERT OR REPLACE INTO ${t} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`,
          cols.map((c) => row[c] ?? null),
        );
      }
    }
  });
  notifyDataChanged();
  return { vehicles: payload.tables.vehicles?.length ?? 0, records: payload.tables.records?.length ?? 0 };
}

/** Every photo path referenced by the data (vehicle covers + record photos). */
export function referencedPhotos(payload: BackupPayload): string[] {
  const out = new Set<string>();
  for (const v of payload.tables.vehicles ?? []) if (typeof v.photo === 'string' && v.photo) out.add(v.photo);
  for (const p of payload.tables.record_photos ?? []) if (typeof p.path === 'string' && p.path) out.add(p.path);
  return [...out];
}
