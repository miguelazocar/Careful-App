/**
 * Direct Google Drive sync: authorization through Google Identity Services (native module
 * `careful-google-auth`) + the pure REST client in `@/lib/google-drive`.
 *
 * Backups go to a visible folder in the user's Drive. With the `drive.file` scope the app can
 * only see the files it created — never the rest of the user's Drive.
 */
import { fetch as expoFetch } from 'expo/fetch';
import { Platform } from 'react-native';

import { backupFileName, backupsToPrune } from '@/domain/backup-policy';
import { createDriveClient, DRIVE_FILE_SCOPE, describeDriveError, type DriveFile, type HttpFetch } from '@/lib/google-drive';
import { getSettings, useSettings } from '@/stores/settings';
import { withExternalActivity } from '@/stores/ui';

import { GoogleAuth, type GoogleAuthErrorCode } from '../../modules/careful-google-auth';

export const DRIVE_FOLDER_NAME = 'Careful Respaldos';
const SCOPES = [DRIVE_FILE_SCOPE];

export type { DriveFile };

export class DriveAuthError extends Error {
  constructor(
    message: string,
    readonly code: GoogleAuthErrorCode | 'ERR_UNAVAILABLE',
  ) {
    super(message);
    this.name = 'DriveAuthError';
  }
}

export function isDriveAvailable(): boolean {
  return Platform.OS === 'android' && GoogleAuth !== null;
}

const AUTH_MESSAGES: Record<string, string> = {
  ERR_CANCELED: 'Conexión cancelada.',
  ERR_CONSENT_REQUIRED: 'Google pide autorizar de nuevo. Entrá a Ajustes › Respaldo y tocá «Reconectar».',
  ERR_DEVELOPER:
    'Google no reconoce esta versión de la app. Revisá en Google Cloud que el cliente Android tenga el paquete com.miguelazocar.careful y la huella SHA-1 del certificado con que se firmó el APK.',
  ERR_NETWORK: 'Sin conexión a internet.',
  ERR_IN_PROGRESS: 'Ya hay una autorización en curso.',
};

function toAuthError(e: unknown): DriveAuthError {
  const code = ((e as { code?: string })?.code ?? 'ERR_AUTH') as GoogleAuthErrorCode;
  const detail = e instanceof Error ? e.message : String(e);
  return new DriveAuthError(AUTH_MESSAGES[code] ?? `No se pudo conectar con Google (${detail}).`, code);
}

interface Token {
  accessToken: string;
  email: string | null;
}

async function authorize(opts: { interactive: boolean; selectAccount?: boolean }): Promise<Token> {
  if (!GoogleAuth) throw new DriveAuthError('Google Drive no está disponible en esta versión de la app.', 'ERR_UNAVAILABLE');
  const auth = GoogleAuth;
  const account = opts.selectAccount ? null : getSettings().drive.email;
  const run = () => auth.authorize({ scopes: SCOPES, account, interactive: opts.interactive, selectAccount: !!opts.selectAccount });
  try {
    // the consent screen sends the app to background: don't let that trigger the lock
    const r = opts.interactive ? await withExternalActivity(run) : await run();
    return { accessToken: r.accessToken, email: r.email };
  } catch (e) {
    throw toAuthError(e);
  }
}

const httpFetch: HttpFetch = (url, init) =>
  // expo/fetch streams Uint8Array bodies natively (no base64 bridge); TS's BodyInit is just narrower
  expoFetch(url, { method: init.method, headers: init.headers, body: init.body as BodyInit | undefined });

/** A Drive client bound to one access token for the duration of an operation (refreshed on 401). */
function driveClient(interactive: boolean, initial?: Token) {
  let token: string | null = initial?.accessToken ?? null;
  return createDriveClient({
    fetch: httpFetch,
    getToken: async () => (token ??= (await authorize({ interactive })).accessToken),
    invalidateToken: async (t) => {
      token = null;
      await GoogleAuth?.clearToken(t).catch(() => undefined);
    },
  });
}

/** Asks the user to choose an account and grant access; stores who is connected. */
export async function connectDrive(): Promise<{ email: string | null }> {
  const auth = await authorize({ interactive: true, selectAccount: true });
  let user: { email: string | null; name: string | null };
  try {
    user = await driveClient(true, auth).about();
  } catch (e) {
    throw new Error(describeDriveError(e));
  }
  const email = user.email ?? auth.email;
  await useSettings.getState().patch('drive', { email, name: user.name, enabled: true, lastError: null, pending: false });
  return { email };
}

/** Revokes the grant (best effort) and forgets the account. Files already in Drive stay there. */
export async function disconnectDrive(): Promise<void> {
  const { email } = getSettings().drive;
  if (GoogleAuth && email) await GoogleAuth.revokeAccess(email, SCOPES).catch(() => undefined);
  await useSettings.getState().patch('drive', { email: null, name: null, enabled: false, lastAt: null, lastError: null, pending: false });
}

/** Uploads a backup zip to "Careful Respaldos" and prunes old copies. */
export async function uploadBackupToDrive(bytes: Uint8Array, opts: { interactive: boolean }): Promise<DriveFile> {
  const drive = driveClient(opts.interactive);
  try {
    const folderId = await drive.ensureFolder(DRIVE_FOLDER_NAME);
    const file = await drive.upload(folderId, backupFileName(), bytes, 'application/zip');
    try {
      const old = backupsToPrune(await drive.listFiles(folderId), getSettings().backup.keep);
      for (const f of old) await drive.remove(f.id);
    } catch {
      // pruning is best effort
    }
    await useSettings.getState().patch('drive', { lastAt: new Date().toISOString(), lastError: null, pending: false });
    return file;
  } catch (e) {
    if (e instanceof DriveAuthError) throw e;
    throw new Error(describeDriveError(e));
  }
}

/** Backups in "Careful Respaldos", newest first. */
export async function listDriveBackups(): Promise<DriveFile[]> {
  const drive = driveClient(true);
  try {
    const folderId = await drive.findFolder(DRIVE_FOLDER_NAME);
    if (!folderId) return [];
    return await drive.listFiles(folderId);
  } catch (e) {
    if (e instanceof DriveAuthError) throw e;
    throw new Error(describeDriveError(e));
  }
}

export async function downloadDriveFile(fileId: string): Promise<Uint8Array> {
  try {
    return await driveClient(true).download(fileId);
  } catch (e) {
    if (e instanceof DriveAuthError) throw e;
    throw new Error(describeDriveError(e));
  }
}
