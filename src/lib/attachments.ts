/**
 * Record attachments: photos and documents (invoice PDF, warranty in Word…), stored next to each
 * other as "photos/<id>.jpg" and "photos/<id>--<original name>". Pure helpers, no I/O.
 */
export const DOC_SEPARATOR = '--';
export const MAX_DOCUMENT_MB = 20;
const IMAGE_EXT = /\.(jpe?g|png|webp|gif|heic|heif)$/i;

const MIME: Record<string, string> = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  odt: 'application/vnd.oasis.opendocument.text',
  ods: 'application/vnd.oasis.opendocument.spreadsheet',
  rtf: 'application/rtf',
  txt: 'text/plain',
  csv: 'text/csv',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  heic: 'image/heic',
  heif: 'image/heif',
};

const extOf = (path: string) => (/\.([a-z0-9]+)$/i.exec(path)?.[1] ?? '').toLowerCase();

/** Photos (and image files) are shown as thumbnails; anything else is a document. */
export function isImagePath(path: string): boolean {
  return IMAGE_EXT.test(path);
}

/** The original file name of a document ("Factura.pdf"); for photos, the stored name. */
export function attachmentName(path: string): string {
  const base = path.split('/').pop() ?? path;
  const i = base.indexOf(DOC_SEPARATOR);
  return i >= 0 ? base.slice(i + DOC_SEPARATOR.length) : base;
}

export function attachmentMime(path: string): string {
  return MIME[extOf(path)] ?? 'application/octet-stream';
}

/** Icon and color for a document tile. */
export function documentVisual(path: string): { icon: string; color: string; label: string } {
  const ext = extOf(path);
  if (ext === 'pdf') return { icon: 'file-pdf-box', color: '#E8384F', label: 'PDF' };
  if (ext === 'doc' || ext === 'docx' || ext === 'odt' || ext === 'rtf') return { icon: 'file-word-box', color: '#2B6CD6', label: ext.toUpperCase() };
  if (ext === 'xls' || ext === 'xlsx' || ext === 'ods' || ext === 'csv') return { icon: 'file-excel-box', color: '#13A974', label: ext.toUpperCase() };
  if (ext === 'ppt' || ext === 'pptx') return { icon: 'file-powerpoint-box', color: '#E8930C', label: ext.toUpperCase() };
  return { icon: 'file-document-outline', color: '#64748B', label: ext ? ext.toUpperCase() : 'Archivo' };
}

/**
 * Name a picked document is stored under: safe characters, and an extension (from its mime type)
 * when the original has none, so it can be opened later.
 */
export function documentFileName(original: string, mimeType?: string | null): string {
  const base = safeFileName(original.split('/').pop() ?? original);
  if (extOf(base) || !mimeType) return base;
  const ext = Object.entries(MIME).find(([, m]) => m === mimeType)?.[0];
  return ext ? `${base}.${ext}` : base;
}

export function safeFileName(name: string): string {
  const clean = name.replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').trim() || 'archivo';
  if (clean.length <= 80) return clean;
  const ext = extOf(clean);
  return `${clean.slice(0, 70)}${ext ? `.${ext}` : ''}`;
}
