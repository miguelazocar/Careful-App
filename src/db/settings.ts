import { getDb } from './connection';

export async function getAllSettings(): Promise<Record<string, unknown>> {
  const rows = await getDb().getAllAsync<{ key: string; value: string }>('SELECT key, value FROM settings');
  const out: Record<string, unknown> = {};
  for (const r of rows) {
    try {
      out[r.key] = JSON.parse(r.value);
    } catch {
      // ignore corrupted value — defaults will be used
    }
  }
  return out;
}

export async function setSetting(key: string, value: unknown): Promise<void> {
  await getDb().runAsync('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [key, JSON.stringify(value)]);
}
