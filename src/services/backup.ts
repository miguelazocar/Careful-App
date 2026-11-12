import Constants from 'expo-constants';
import { Directory, File, Paths } from 'expo-file-system';
import * as Network from 'expo-network';
import * as Sharing from 'expo-sharing';
import { strFromU8, strToU8, unzipSync, zipSync, type Zippable } from 'fflate';
import { AppState } from 'react-native';

import { onDataChanged } from '@/db/connection';
import { exportSnapshot, importSnapshot, referencedPhotos, validatePayload, type BackupPayload } from '@/db/snapshot';
import { listVehicles } from '@/db/vehicles';
import { BACKUP_FILE_NAME, backupFileName, CHANGE_DEBOUNCE_MS, connectionAllowsUpload, isBackupFileName, isDailyBackupDue, type ConnectionKind } from '@/domain/backup-policy';
import { getSettings, useSettings } from '@/stores/settings';
import { withExternalActivity } from '@/stores/ui';

import { downloadDriveFile, uploadBackupToDrive } from './drive';
import { PHOTO_DIR } from './photos';

const DATA_ENTRY = 'careful-backup.json';

const appVersion = () => Constants.expoConfig?.version ?? 'dev';

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

/** True when the snapshot has no vehicles (nothing worth backing up). */
export function isEmptyBackup(payload: BackupPayload): boolean {
  return (payload.tables.vehicles?.length ?? 0) === 0;
}

/** Whether the local database has anything worth backing up. */
export async function hasLocalData(): Promise<boolean> {
  return (await listVehicles({ includeArchived: true })).length > 0;
}

/**
 * Writes the backup into the user-chosen folder (Android Storage Access Framework) as a single
 * file, `careful-respaldo.zip`, replacing the previous one (and older dated copies).
 * SAF can't rename and doesn't always truncate on write, so the old file is removed and written anew.
 */
export async function backupToFolder(zip?: Uint8Array): Promise<BackupResult> {
  const { folderUri } = getSettings().backup;
  if (!folderUri) throw new Error('Elegí una carpeta para los respaldos automáticos.');
  const bytes = zip ?? (await buildBackupZip()).bytes;
  const dir = new Directory(folderUri);
  removeFolderBackups(dir);
  const file = dir.createFile(BACKUP_FILE_NAME, 'application/zip');
  await file.write(bytes);
  await useSettings.getState().patch('backup', { lastBackupAt: new Date().toISOString(), lastError: null });
  return { name: BACKUP_FILE_NAME, size: bytes.length };
}

function removeFolderBackups(dir: Directory): void {
  try {
    for (const entry of dir.list()) {
      if (!(entry instanceof File)) continue;
      const name = decodeURIComponent(entry.name).split('/').pop() ?? '';
      if (isBackupFileName(name)) entry.delete();
    }
  } catch {
    // listing SAF folders can fail on some providers — cleaning up is best effort
  }
}

/** Manual "Subir ahora" to Google Drive (may show Google's consent screen). */
export async function backupToDriveNow(): Promise<BackupResult> {
  const { bytes, payload } = await buildBackupZip();
  if (isEmptyBackup(payload)) throw new Error('Todavía no hay datos para respaldar: agregá un vehículo primero.');
  const file = await uploadBackupToDrive(bytes, { interactive: true });
  return { name: file.name, size: bytes.length };
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
  const file = new File(Paths.cache, backupFileName());
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

export async function readDriveBackup(fileId: string): Promise<RestorePreview> {
  return parseBackup(await downloadDriveFile(fileId));
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

/** Every configured destination is automatic: after each change and once a day after midnight. */
const folderAuto = () => !!getSettings().backup.folderUri;
const driveAuto = () => !!getSettings().drive.email;

export function isFolderBackupDue(now = new Date()): boolean {
  return folderAuto() && isDailyBackupDue(getSettings().backup.lastBackupAt, now);
}

export function isDriveBackupDue(now = new Date()): boolean {
  const d = getSettings().drive;
  return driveAuto() && (d.pending || isDailyBackupDue(d.lastAt, now));
}

export function isBackupDue(now = new Date()): boolean {
  return isFolderBackupDue(now) || isDriveBackupDue(now);
}

/** Any automatic destination enabled (folder or Drive). */
export function hasAutomaticBackups(): boolean {
  return folderAuto() || driveAuto();
}

export async function connectionKind(): Promise<ConnectionKind> {
  try {
    const s = await Network.getNetworkStateAsync();
    if (s.isConnected === false || s.type === Network.NetworkStateType.NONE) return 'none';
    if (s.type === Network.NetworkStateType.WIFI || s.type === Network.NetworkStateType.ETHERNET) return 'wifi';
    if (s.type === Network.NetworkStateType.CELLULAR) return 'cellular';
    return 'other';
  } catch {
    return 'other';
  }
}

type Trigger = 'schedule' | 'change' | 'launch' | 'network';

let running: Promise<boolean> | null = null;
/** A change arrived while a backup was running: back up again once it finishes. */
let changedWhileRunning = false;

/**
 * Daily / after-change / launch backups to every configured destination (folder and Drive).
 * The zip is built once. Drive respects "Solo con Wi-Fi": when blocked, the upload stays
 * pending and runs at the next chance (Wi-Fi connects, the app opens, or the periodic worker).
 */
export function runAutomaticBackup(reason: Trigger): Promise<boolean> {
  if (running) {
    // never overlap; but a change made during the backup must not be lost
    if (reason === 'change') changedWhileRunning = true;
    return running;
  }
  running = doAutomaticBackup(reason).finally(() => {
    running = null;
    if (changedWhileRunning) {
      changedWhileRunning = false;
      scheduleChangeBackup();
    }
  });
  return running;
}

async function doAutomaticBackup(reason: Trigger): Promise<boolean> {
  const toFolder = folderAuto() && (reason === 'change' || isFolderBackupDue());
  let toDrive = driveAuto() && (reason === 'change' || isDriveBackupDue());
  if (toDrive && !connectionAllowsUpload(await connectionKind(), getSettings().drive.wifiOnly)) {
    toDrive = false;
    if (!getSettings().drive.pending) await useSettings.getState().patch('drive', { pending: true });
  }
  if (!toFolder && !toDrive) return false;

  let bytes: Uint8Array;
  try {
    const zip = await buildBackupZip();
    // An empty garage (fresh install, "Borrar todos los datos") must never push real backups out of rotation.
    if (isEmptyBackup(zip.payload)) {
      if (toDrive && getSettings().drive.pending) await useSettings.getState().patch('drive', { pending: false });
      return false;
    }
    bytes = zip.bytes;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (toFolder) await useSettings.getState().patch('backup', { lastError: msg });
    if (toDrive) await useSettings.getState().patch('drive', { lastError: msg, pending: true });
    return false;
  }

  let ok = true;
  if (toFolder) {
    try {
      await backupToFolder(bytes);
    } catch (e) {
      ok = false;
      await useSettings.getState().patch('backup', { lastError: e instanceof Error ? e.message : String(e) });
    }
  }
  if (toDrive) {
    try {
      await uploadBackupToDrive(bytes, { interactive: false });
    } catch (e) {
      ok = false;
      await useSettings.getState().patch('drive', { lastError: e instanceof Error ? e.message : String(e), pending: true });
    }
  }
  return ok;
}

let changeTimer: ReturnType<typeof setTimeout> | null = null;
let started = false;

/** Debounced: many changes in a row produce a single backup, after the last one. */
function scheduleChangeBackup(): void {
  if (!hasAutomaticBackups()) return;
  if (changeTimer) clearTimeout(changeTimer);
  changeTimer = setTimeout(() => {
    changeTimer = null;
    void runAutomaticBackup('change');
  }, CHANGE_DEBOUNCE_MS);
}

/**
 * Triggers while the app runs:
 * - every data change schedules a backup, CHANGE_DEBOUNCE_MS after the last one;
 * - a pending Drive upload runs when the network comes back or the app returns to the foreground.
 */
export function startChangeBackups(): void {
  if (started) return;
  started = true;
  onDataChanged(scheduleChangeBackup);
  Network.addNetworkStateListener((s) => {
    if (s.isConnected === false || !getSettings().drive.pending || !driveAuto()) return;
    void runAutomaticBackup('network');
  });
  AppState.addEventListener('change', (state) => {
    if (state === 'active' && getSettings().drive.pending && driveAuto()) void runAutomaticBackup('launch');
  });
}
