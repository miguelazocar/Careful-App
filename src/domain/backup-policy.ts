/**
 * When and where automatic backups run. Pure: the services layer feeds it settings,
 * the network state and file listings.
 */

export const BACKUP_FILE_PREFIX = 'careful-respaldo-';

/** Grace so a worker that fires a little early still counts as "on time". */
const EARLY_TOLERANCE_MS = 60_000;

const pad = (n: number) => n.toString().padStart(2, '0');

/** `careful-respaldo-2026-11-07_2136.zip` (local time, sortable). */
export function backupFileName(d = new Date()): string {
  return `${BACKUP_FILE_PREFIX}${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}.zip`;
}

export function isBackupFileName(name: string): boolean {
  return name.startsWith(BACKUP_FILE_PREFIX) && name.toLowerCase().endsWith('.zip');
}

/** Local date encoded in a backup file name, or null for foreign names. */
export function backupDateFromName(name: string): Date | null {
  const m = /^careful-respaldo-(\d{4})-(\d{2})-(\d{2})_(\d{2})(\d{2})/.exec(name);
  if (!m) return null;
  const [y, mo, d, h, mi] = m.slice(1).map(Number);
  const date = new Date(y, mo - 1, d, h, mi);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** True when `intervalHours` have passed since `lastAt` (or there was never a backup). */
export function isDue(lastAt: string | null, intervalHours: number, now = new Date()): boolean {
  if (!lastAt) return true;
  const last = new Date(lastAt).getTime();
  if (Number.isNaN(last)) return true;
  return now.getTime() - last >= intervalHours * 3_600_000 - EARLY_TOLERANCE_MS;
}

export type ConnectionKind = 'wifi' | 'cellular' | 'other' | 'none';

/** "Solo Wi-Fi" never spends mobile data; unknown links (VPN, Bluetooth…) count as not-Wi-Fi. */
export function connectionAllowsUpload(kind: ConnectionKind, wifiOnly: boolean): boolean {
  if (kind === 'none') return false;
  return wifiOnly ? kind === 'wifi' : true;
}

/** Oldest backups beyond `keep` (at least one is always kept). Newest is decided by name, then creation time. */
export function backupsToPrune<T extends { name: string; createdTime?: string }>(files: T[], keep: number): T[] {
  const key = (f: T) => backupDateFromName(f.name)?.getTime() ?? (f.createdTime ? new Date(f.createdTime).getTime() : 0);
  const ours = files.filter((f) => isBackupFileName(f.name));
  const sorted = [...ours].sort((a, b) => key(b) - key(a) || (b.createdTime ?? '').localeCompare(a.createdTime ?? ''));
  return sorted.slice(Math.max(1, Math.floor(keep)));
}
