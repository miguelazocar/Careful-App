import Constants from 'expo-constants';
import { Directory, File, Paths } from 'expo-file-system';
import * as Network from 'expo-network';
import * as Sharing from 'expo-sharing';
import { strFromU8, strToU8, unzipSync, zipSync, type Zippable } from 'fflate';

import { onDataChanged } from '@/db/connection';
import { exportSnapshot, importSnapshot, referencedPhotos, validatePayload, type BackupPayload } from '@/db/snapshot';
import { getSettings, useSettings } from '@/stores/settings';
import { withExternalActivity } from '@/stores/ui';

import { PHOTO_DIR } from './photos';

const DATA_ENTRY = 'careful-backup.json';
const FILE_PREFIX = 'careful-respaldo-';

const appVersion = () => Constants.expoConfig?.version ?? 'dev';

function timestampName(d = new Date()): string {
  const p = (n: number) => n.toString().padStart(2, '0');
  return `${FILE_PREFIX}${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}.zip`;
}

/** Zip = data JSON + every referenced photo (already-compressed JPEGs are stored, not deflated). */
export async function buildBackupZip(): Promise<{ bytes: Uint8Array; payload: BackupPayload }> {
  const payload = await exportSnapshot(appVersion());
  const files: Zippable = { [DATA_ENTRY]: strToU8(JSON.stringify(payload)) };
  for (const rel of referencedPhotos(payload)) {
    if (/^(content|https?|file):/.test(rel)) continue;
    const f = new File(Paths.document, rel);
    if (!f.exists) continue;
    files[rel] = [await f.bytes(), { level: 0 }];
  }
  return { bytes: zipSync(files, { level: 6 }), payload };
}

export interface BackupResult {
  name: string;
  size: number;
}

/** Writes a backup into the user-chosen folder (Android Storage Access Framework). */
export async function backupToFolder(): Promise<BackupResult> {
  const { folderUri, keep } = getSettings().backup;
  if (!folderUri) throw new Error('Elegí una carpeta para los respaldos automáticos.');
  const { bytes } = await buildBackupZip();
  const dir = new Directory(folderUri);
  const name = timestampName();
  const file = dir.createFile(name, 'application/zip');
  await file.write(bytes);
  pruneOldBackups(dir, keep);
  await useSettings.getState().patch('backup', { lastBackupAt: new Date().toISOString(), lastError: null });
  return { name, size: bytes.length };
}

function pruneOldBackups(dir: Directory, keep: number): void {
  try {
    const backups = dir
      .list()
      .filter((e): e is File => e instanceof File && decodeURIComponent(e.name).startsWith(FILE_PREFIX))
      .sort((a, b) => (decodeURIComponent(a.name) < decodeURIComponent(b.name) ? 1 : -1));
    for (const old of backups.slice(Math.max(1, keep))) old.delete();
  } catch {
    // listing SAF folders can fail on some providers — pruning is best effort
  }
}

export async function pickBackupFolder(): Promise<{ uri: string; label: string } | null> {
  try {
    const dir = await withExternalActivity(() => Directory.pickDirectoryAsync());
    if (!dir) return null;
    const label = decodeURIComponent(dir.uri.split('%3A').pop() ?? dir.name ?? 'Carpeta')
      .replace(/^.*tree\//, '')
      .replace(/\/+$/, '');
    return { uri: dir.uri, label: label || 'Carpeta seleccionada' };
  } catch (e) {
    if (String(e).toLowerCase().includes('cancel')) return null;
    throw e;
  }
}

/** Creates a backup in cache and opens the share sheet (Drive, Gmail, WhatsApp…). */
export async function shareBackup(): Promise<void> {
  const { bytes } = await buildBackupZip();
  const file = new File(Paths.cache, timestampName());
  if (file.exists) file.delete();
  file.create();
  await file.write(bytes);
  await withExternalActivity(() =>
    Sharing.shareAsync(file.uri, { mimeType: 'application/zip', dialogTitle: 'Guardar respaldo de Careful' }),
  );
}

export interface RestorePreview {
  payload: BackupPayload;
  photos: Record<string, Uint8Array>;
  vehicles: number;
  records: number;
  exportedAt: string;
}

export async function readBackupFile(): Promise<RestorePreview | null> {
  const picked = await withExternalActivity(() =>
    File.pickFileAsync({ mimeTypes: ['application/zip', 'application/octet-stream', 'application/x-zip-compressed'] }),
  );
  if (!picked || picked.canceled || !picked.result) return null;
  return parseBackup(await picked.result.bytes());
}

export function parseBackup(bytes: Uint8Array): RestorePreview {
  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipSync(bytes);
  } catch {
    throw new Error('No se pudo leer el archivo. ¿Es un respaldo .zip de Careful?');
  }
  const json = entries[DATA_ENTRY];
  if (!json) throw new Error('El archivo no contiene datos de Careful.');
  const payload = JSON.parse(strFromU8(json)) as unknown;
  validatePayload(payload);
  const photos: Record<string, Uint8Array> = {};
  for (const [name, data] of Object.entries(entries)) if (name.startsWith(`${PHOTO_DIR}/`)) photos[name] = data;
  return {
    payload,
    photos,
    vehicles: payload.tables.vehicles?.length ?? 0,
    records: payload.tables.records?.length ?? 0,
    exportedAt: payload.exportedAt,
  };
}

/** Replaces all local data and photos with the backup. */
export async function restoreBackup(preview: RestorePreview): Promise<void> {
  const photoDir = new Directory(Paths.document, PHOTO_DIR);
  const staging = new Directory(Paths.document, `${PHOTO_DIR}-restore`);
  if (staging.exists) staging.delete();
  staging.create({ intermediates: true });
  for (const [rel, data] of Object.entries(preview.photos)) {
    const name = rel.slice(PHOTO_DIR.length + 1);
    if (!name || name.includes('/')) continue;
    const f = new File(staging, name);
    f.create();
    await f.write(data);
  }
  await importSnapshot(preview.payload);
  // swap photo folders only after the data import succeeded
  if (photoDir.exists) photoDir.delete();
  staging.rename(PHOTO_DIR);
  await useSettings.getState().load();
}

/* --------------------------- Automatic backups --------------------------- */

export function isBackupDue(now = new Date()): boolean {
  const { enabled, folderUri, lastBackupAt, intervalHours } = getSettings().backup;
  if (!enabled || !folderUri) return false;
  if (!lastBackupAt) return true;
  return now.getTime() - new Date(lastBackupAt).getTime() >= intervalHours * 3600_000 - 60_000;
}

export async function runAutomaticBackup(reason: 'schedule' | 'change' | 'launch'): Promise<boolean> {
  const { enabled, folderUri } = getSettings().backup;
  if (!enabled || !folderUri) return false;
  if (reason !== 'change' && !isBackupDue()) return false;
  try {
    await backupToFolder();
    return true;
  } catch (e) {
    await useSettings.getState().patch('backup', { lastError: e instanceof Error ? e.message : String(e) });
    return false;
  }
}

let changeTimer: ReturnType<typeof setTimeout> | null = null;
let changeSubscription: (() => void) | null = null;

/** "Sincronización adicional por cada acción registrada": debounced backup after data changes. */
export function startChangeBackups(): void {
  if (changeSubscription) return;
  changeSubscription = onDataChanged(() => {
    const { enabled, onEveryChange } = getSettings().backup;
    if (!enabled || !onEveryChange) return;
    if (changeTimer) clearTimeout(changeTimer);
    changeTimer = setTimeout(() => void runAutomaticBackup('change'), 8000);
  });
}

export async function isOnWifi(): Promise<boolean> {
  const s = await Network.getNetworkStateAsync();
  return s.type === Network.NetworkStateType.WIFI || s.type === Network.NetworkStateType.ETHERNET;
}
