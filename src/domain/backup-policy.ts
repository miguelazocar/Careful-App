/**
 * When and where automatic backups run. Pure: the services layer feeds it settings,
 * the network state and file listings.
 */

export const BACKUP_FILE_PREFIX = 'careful-respaldo-';

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

export interface RetentionPolicy {
  /** Most recent backups always kept (one per change can pile up quickly). */
  recent: number;
  /** Besides those, the newest backup of each of the last N days, so history survives many edits. */
  days: number;
}

export const DEFAULT_RETENTION: RetentionPolicy = { recent: 5, days: 14 };

const dayOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/**
 * Backups to delete under the retention policy. Only our own files are considered; the newest
 * one is never deleted. Newest is decided by the name's timestamp, then creation time.
 */
export function backupsToPrune<T extends { name: string; createdTime?: string }>(files: T[], policy: RetentionPolicy = DEFAULT_RETENTION, now = new Date()): T[] {
  const dateOf = (f: T) => backupDateFromName(f.name) ?? (f.createdTime ? new Date(f.createdTime) : new Date(0));
  const ours = files.filter((f) => isBackupFileName(f.name));
  const sorted = [...ours].sort((a, b) => dateOf(b).getTime() - dateOf(a).getTime() || (b.createdTime ?? '').localeCompare(a.createdTime ?? ''));
  const oldestDay = dayOf(new Date(now.getFullYear(), now.getMonth(), now.getDate() - (policy.days - 1)));
  const keptDays = new Set<string>();
  return sorted.filter((f, i) => {
    const day = dayOf(dateOf(f));
    if (i < Math.max(1, policy.recent)) {
      keptDays.add(day); // a recent copy already represents its day
      return false;
    }
    if (day >= oldestDay && !keptDays.has(day)) {
      keptDays.add(day);
      return false;
    }
    return true;
  });
}
