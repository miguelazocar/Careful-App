/**
 * When and where automatic backups run. Pure: the services layer feeds it settings,
 * the network state and file listings.
 */

/** The one backup file: every backup replaces it (in Drive it is updated in place). */
export const BACKUP_FILE_NAME = 'careful-respaldo.zip';

/** Name of the backup file (always the same: there is a single copy that gets updated). */
export function backupFileName(): string {
  return BACKUP_FILE_NAME;
}

/**
 * Ours: the single backup plus what older versions left behind (one dated file per backup,
 * `careful-respaldo-2026-11-07_2136.zip`) and provider renames like `careful-respaldo (1).zip`.
 */
export function isBackupFileName(name: string): boolean {
  const n = name.toLowerCase();
  return n.startsWith('careful-respaldo') && n.endsWith('.zip');
}

/** Our backup files other than `keep` (the one just written or updated): they get deleted. */
export function staleBackups<T extends { name: string }>(files: T[], keep?: T | null): T[] {
  return files.filter((f) => f !== keep && isBackupFileName(f.name));
}

/** Local date encoded in an old dated backup name, or null. */
export function backupDateFromName(name: string): Date | null {
  const m = /^careful-respaldo-(\d{4})-(\d{2})-(\d{2})_(\d{2})(\d{2})/.exec(name);
  if (!m) return null;
  const [y, mo, d, h, mi] = m.slice(1).map(Number);
  const date = new Date(y, mo - 1, d, h, mi);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Quiet time after the last change before backing up, so a burst of edits produces one backup. */
export const CHANGE_DEBOUNCE_MS = 10_000;

/**
 * Daily backup "at midnight": due when there was no backup since the last local midnight.
 * The periodic worker checks hourly, so it runs at the first chance after 00:00.
 */
export function isDailyBackupDue(lastAt: string | null, now = new Date()): boolean {
  if (!lastAt) return true;
  const last = new Date(lastAt).getTime();
  if (Number.isNaN(last)) return true;
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return last < midnight;
}

export type ConnectionKind = 'wifi' | 'cellular' | 'other' | 'none';

/** "Solo Wi-Fi" never spends mobile data; unknown links (VPN, Bluetooth…) count as not-Wi-Fi. */
export function connectionAllowsUpload(kind: ConnectionKind, wifiOnly: boolean): boolean {
  if (kind === 'none') return false;
  return wifiOnly ? kind === 'wifi' : true;
}
