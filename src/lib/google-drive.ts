/**
 * Minimal Google Drive v3 REST client for backups. Pure: the HTTP function and the
 * token provider are injected, so it runs (and is tested) without React Native.
 *
 * Scope `drive.file`: the app only sees files it created itself, never the rest of the user's Drive.
 */

export const DRIVE_FILE_SCOPE = 'https://www.googleapis.com/auth/drive.file';

const API = 'https://www.googleapis.com/drive/v3';
const UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3';
export const FOLDER_MIME = 'application/vnd.google-apps.folder';
const FILE_FIELDS = 'id,name,size,createdTime,modifiedTime';

export interface DriveFile {
  id: string;
  name: string;
  size: number;
  createdTime: string;
  /** Last content update (the single backup is updated in place). */
  modifiedTime: string;
}

export interface DriveUser {
  email: string | null;
  name: string | null;
}

export interface HttpResponse {
  ok: boolean;
  status: number;
  headers: { get(name: string): string | null };
  text(): Promise<string>;
  arrayBuffer(): Promise<ArrayBuffer>;
}

export type HttpFetch = (
  url: string,
  init: { method: string; headers: Record<string, string>; body?: string | Uint8Array },
) => Promise<HttpResponse>;

export interface DriveClientDeps {
  fetch: HttpFetch;
  /** Returns a valid OAuth access token. */
  getToken(): Promise<string>;
  /** Called with a token the API rejected (401). The next getToken() must return a fresh one. */
  invalidateToken(token: string): Promise<void>;
}

export class DriveError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly reason: string | null,
  ) {
    super(message);
    this.name = 'DriveError';
  }
}

/** Builds a query string without URLSearchParams (incomplete in React Native). */
export function queryString(params: Record<string, string | number | undefined>): string {
  return Object.entries(params)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join('&');
}

/** Escapes a literal for Drive's `q` search syntax. */
export function escapeQuery(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

interface ApiErrorBody {
  error?: {
    code?: number;
    message?: string;
    status?: string;
    errors?: { reason?: string; message?: string }[];
    details?: { reason?: string }[];
  };
}

async function toDriveError(res: HttpResponse): Promise<DriveError> {
  let body: ApiErrorBody = {};
  try {
    body = JSON.parse(await res.text()) as ApiErrorBody;
  } catch {
    // non-JSON error page
  }
  const reason = body.error?.errors?.[0]?.reason ?? body.error?.details?.find((d) => d.reason)?.reason ?? body.error?.status ?? null;
  return new DriveError(body.error?.message ?? `HTTP ${res.status}`, res.status, reason);
}

/** User-facing (Spanish) explanation of a Drive API failure. */
export function describeDriveError(e: unknown): string {
  if (!(e instanceof DriveError)) return e instanceof Error ? e.message : String(e);
  const r = (e.reason ?? '').toLowerCase();
  if (e.status === 401) return 'Google rechazó el acceso. Volvé a conectar Google Drive.';
  if (r === 'storagequotaexceeded') return 'Tu Google Drive no tiene espacio libre.';
  if (r === 'accessnotconfigured' || r === 'service_disabled' || /has not been used|is disabled/i.test(e.message))
    return 'La Google Drive API no está habilitada en el proyecto de Google Cloud.';
  if (e.status === 429 || r.includes('ratelimitexceeded')) return 'Google Drive está ocupado. Probá de nuevo en unos minutos.';
  if (e.status === 404) return 'No se encontró el archivo en Google Drive.';
  if (e.status >= 500) return 'Google Drive no responde. Probá más tarde.';
  return `Error de Google Drive (${e.status}): ${e.message}`;
}

export function createDriveClient(deps: DriveClientDeps) {
  async function call(url: string, method = 'GET', headers: Record<string, string> = {}, body?: string | Uint8Array): Promise<HttpResponse> {
    for (let attempt = 0; ; attempt++) {
      const token = await deps.getToken();
      const res = await deps.fetch(url, { method, headers: { ...headers, Authorization: `Bearer ${token}` }, body });
      if (res.status === 401 && attempt === 0) {
        await deps.invalidateToken(token);
        continue;
      }
      if (!res.ok) throw await toDriveError(res);
      return res;
    }
  }

  async function json<T>(url: string, method = 'GET', payload?: unknown): Promise<T> {
    const res = await call(url, method, payload === undefined ? {} : { 'Content-Type': 'application/json; charset=UTF-8' }, payload === undefined ? undefined : JSON.stringify(payload));
    return JSON.parse(await res.text()) as T;
  }

  type RawFile = { id: string; name: string; size?: string | number; createdTime?: string; modifiedTime?: string };
  const toFile = (f: RawFile): DriveFile => ({
    id: f.id,
    name: f.name,
    size: Number(f.size ?? 0),
    createdTime: f.createdTime ?? '',
    modifiedTime: f.modifiedTime ?? f.createdTime ?? '',
  });

  /** Sends the bytes to a resumable session opened by `start` (one PUT, any size). */
  async function sendResumable(start: HttpResponse, bytes: Uint8Array, mimeType: string): Promise<DriveFile> {
    const session = start.headers.get('location');
    if (!session) throw new DriveError('Google Drive no devolvió la sesión de subida.', start.status, null);
    const res = await call(session, 'PUT', { 'Content-Type': mimeType }, bytes);
    return toFile(JSON.parse(await res.text()) as RawFile);
  }

  return {
    async about(): Promise<DriveUser> {
      const r = await json<{ user?: { emailAddress?: string; displayName?: string } }>(`${API}/about?${queryString({ fields: 'user(emailAddress,displayName)' })}`);
      return { email: r.user?.emailAddress ?? null, name: r.user?.displayName ?? null };
    },

    async findFolder(name: string): Promise<string | null> {
      const q = `name='${escapeQuery(name)}' and mimeType='${FOLDER_MIME}' and trashed=false`;
      const r = await json<{ files?: { id: string }[] }>(`${API}/files?${queryString({ q, spaces: 'drive', orderBy: 'createdTime', pageSize: 10, fields: 'files(id)' })}`);
      return r.files?.[0]?.id ?? null;
    },

    async ensureFolder(name: string): Promise<string> {
      const existing = await this.findFolder(name);
      if (existing) return existing;
      const created = await json<{ id: string }>(`${API}/files?${queryString({ fields: 'id' })}`, 'POST', { name, mimeType: FOLDER_MIME });
      return created.id;
    },

    async listFiles(folderId: string): Promise<DriveFile[]> {
      const q = `'${escapeQuery(folderId)}' in parents and trashed=false and mimeType!='${FOLDER_MIME}'`;
      const r = await json<{ files?: RawFile[] }>(
        `${API}/files?${queryString({ q, spaces: 'drive', orderBy: 'createdTime desc', pageSize: 100, fields: `files(${FILE_FIELDS})` })}`,
      );
      return (r.files ?? []).map(toFile);
    },

    /** Resumable upload in a single PUT: works for any size (multipart uploads are capped at 5 MB). */
    async upload(folderId: string, name: string, bytes: Uint8Array, mimeType: string): Promise<DriveFile> {
      const start = await call(
        `${UPLOAD_API}/files?${queryString({ uploadType: 'resumable', fields: FILE_FIELDS })}`,
        'POST',
        {
          'Content-Type': 'application/json; charset=UTF-8',
          'X-Upload-Content-Type': mimeType,
          'X-Upload-Content-Length': String(bytes.length),
        },
        JSON.stringify({ name, parents: [folderId], mimeType }),
      );
      return sendResumable(start, bytes, mimeType);
    },

    /** Replaces the content of an existing file (same id, same name). */
    async update(fileId: string, bytes: Uint8Array, mimeType: string): Promise<DriveFile> {
      const start = await call(
        `${UPLOAD_API}/files/${encodeURIComponent(fileId)}?${queryString({ uploadType: 'resumable', fields: FILE_FIELDS })}`,
        'PATCH',
        {
          'Content-Type': 'application/json; charset=UTF-8',
          'X-Upload-Content-Type': mimeType,
          'X-Upload-Content-Length': String(bytes.length),
        },
        '{}',
      );
      return sendResumable(start, bytes, mimeType);
    },

    async download(fileId: string): Promise<Uint8Array> {
      const res = await call(`${API}/files/${encodeURIComponent(fileId)}?alt=media`);
      return new Uint8Array(await res.arrayBuffer());
    },

    async remove(fileId: string): Promise<void> {
      await call(`${API}/files/${encodeURIComponent(fileId)}`, 'DELETE');
    },
  };
}

export type DriveClient = ReturnType<typeof createDriveClient>;
