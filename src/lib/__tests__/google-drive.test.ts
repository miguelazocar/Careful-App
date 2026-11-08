/// <reference types="jest" />
/// <reference types="node" />
import { createDriveClient, describeDriveError, DriveError, escapeQuery, FOLDER_MIME, queryString, type HttpFetch, type HttpResponse } from '../google-drive';

interface Call {
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: string | Uint8Array;
}

function response(status: number, body: unknown = {}, headers: Record<string, string> = {}): HttpResponse {
  const text = typeof body === 'string' ? body : JSON.stringify(body);
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (n) => headers[n.toLowerCase()] ?? null },
    text: async () => text,
    arrayBuffer: async () => new TextEncoder().encode(text).buffer as ArrayBuffer,
  };
}

function harness(routes: ((c: Call) => HttpResponse | undefined)[]) {
  const calls: Call[] = [];
  const invalidated: string[] = [];
  let tokenN = 1;
  const fetch: HttpFetch = async (url, init) => {
    const call = { url, ...init };
    calls.push(call);
    for (const r of routes) {
      const res = r(call);
      if (res) return res;
    }
    return response(500, { error: { message: `unexpected ${init.method} ${url}` } });
  };
  const client = createDriveClient({
    fetch,
    getToken: async () => `tok${tokenN}`,
    invalidateToken: async (t) => {
      invalidated.push(t);
      tokenN++;
    },
  });
  return { client, calls, invalidated };
}

describe('helpers', () => {
  it('builds query strings and escapes Drive search literals', () => {
    expect(queryString({ a: 'x y', b: 2, c: undefined })).toBe('a=x%20y&b=2');
    expect(escapeQuery("Careful's \\ backups")).toBe("Careful\\'s \\\\ backups");
  });
});

describe('Drive client', () => {
  it('sends the bearer token and retries once with a fresh token after 401', async () => {
    const { client, calls, invalidated } = harness([
      (c) => (c.headers.Authorization === 'Bearer tok1' ? response(401, { error: { message: 'expired' } }) : undefined),
      (c) => (c.url.includes('/about') ? response(200, { user: { emailAddress: 'a@b.com', displayName: 'Ana' } }) : undefined),
    ]);
    await expect(client.about()).resolves.toEqual({ email: 'a@b.com', name: 'Ana' });
    expect(invalidated).toEqual(['tok1']);
    expect(calls.map((c) => c.headers.Authorization)).toEqual(['Bearer tok1', 'Bearer tok2']);
  });

  it('gives up after the second 401', async () => {
    const { client } = harness([() => response(401, { error: { message: 'nope' } })]);
    await expect(client.about()).rejects.toMatchObject({ status: 401 });
  });

  it('reuses an existing folder and creates it only when missing', async () => {
    let created = false;
    const { client, calls } = harness([
      (c) => (c.method === 'GET' && c.url.includes('/files?') ? response(200, { files: created ? [{ id: 'F1' }] : [] }) : undefined),
      (c) => {
        if (c.method !== 'POST') return undefined;
        created = true;
        return response(200, { id: 'F1' });
      },
    ]);
    await expect(client.ensureFolder("Careful's")).resolves.toBe('F1');
    expect(decodeURIComponent(calls[0].url)).toContain(`name='Careful\\'s' and mimeType='${FOLDER_MIME}' and trashed=false`);
    expect(JSON.parse(String(calls[1].body))).toEqual({ name: "Careful's", mimeType: FOLDER_MIME });
    await expect(client.ensureFolder("Careful's")).resolves.toBe('F1');
    expect(calls.filter((c) => c.method === 'POST')).toHaveLength(1);
  });

  it('uploads with a resumable session in two requests', async () => {
    const bytes = new Uint8Array([80, 75, 3, 4]);
    const { client, calls } = harness([
      (c) => (c.method === 'POST' && c.url.includes('uploadType=resumable') ? response(200, '', { location: 'https://upload.example/session1' }) : undefined),
      (c) => (c.method === 'PUT' && c.url === 'https://upload.example/session1' ? response(200, { id: 'Z1', name: 'b.zip', size: '4', createdTime: '2026-11-07T00:00:00Z' }) : undefined),
    ]);
    await expect(client.upload('F1', 'b.zip', bytes, 'application/zip')).resolves.toEqual({ id: 'Z1', name: 'b.zip', size: 4, createdTime: '2026-11-07T00:00:00Z' });
    expect(calls[0].headers['X-Upload-Content-Length']).toBe('4');
    expect(JSON.parse(String(calls[0].body))).toEqual({ name: 'b.zip', parents: ['F1'], mimeType: 'application/zip' });
    expect(calls[1].body).toBe(bytes);
    expect(calls[1].headers['Content-Type']).toBe('application/zip');
  });

  it('lists files with numeric sizes and downloads bytes', async () => {
    const { client } = harness([
      (c) => (c.url.includes('alt=media') ? response(200, 'PK') : undefined),
      (c) => (c.url.includes('/files?') ? response(200, { files: [{ id: '1', name: 'x.zip', size: '2048', createdTime: 't' }] }) : undefined),
    ]);
    await expect(client.listFiles('F1')).resolves.toEqual([{ id: '1', name: 'x.zip', size: 2048, createdTime: 't' }]);
    await expect(client.download('1')).resolves.toEqual(new Uint8Array([80, 75]));
  });
});

describe('describeDriveError', () => {
  it('explains the common failures in Spanish', () => {
    expect(describeDriveError(new DriveError('x', 403, 'storageQuotaExceeded'))).toMatch(/espacio/);
    expect(describeDriveError(new DriveError('Google Drive API has not been used in project 1 before or it is disabled', 403, 'PERMISSION_DENIED'))).toMatch(/no está habilitada/);
    expect(describeDriveError(new DriveError('x', 403, 'SERVICE_DISABLED'))).toMatch(/no está habilitada/);
    expect(describeDriveError(new DriveError('x', 401, null))).toMatch(/Volvé a conectar/);
    expect(describeDriveError(new DriveError('x', 503, null))).toMatch(/no responde/);
    expect(describeDriveError(new Error('boom'))).toBe('boom');
  });
});
