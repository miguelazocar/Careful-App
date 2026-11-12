import * as DocumentPicker from 'expo-document-picker';
import { Directory, File, Paths } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

import { attachmentMime, attachmentName, DOC_SEPARATOR, documentFileName, MAX_DOCUMENT_MB } from '@/lib/attachments';
import { newId } from '@/lib/id';
import { withExternalActivity } from '@/stores/ui';

/**
 * Photos are stored inside the app's documents directory and referenced by a *relative* path
 * ("photos/<id>.jpg"). Absolute paths would break after a restore on another device.
 */
export const PHOTO_DIR = 'photos';
const MAX_SIDE = 1600;
const QUALITY = 0.72;

function photoDir(): Directory {
  const dir = new Directory(Paths.document, PHOTO_DIR);
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  return dir;
}

export function photoUri(relPath: string | null | undefined): string | null {
  if (!relPath) return null;
  if (/^(file|content|https?):/.test(relPath)) return relPath;
  return new File(Paths.document, relPath).uri;
}

export type PhotoSource = 'camera' | 'library';

export interface PickedPhoto {
  /** Relative path, ready to persist. */
  path: string;
  /** Absolute URI, ready to display. */
  uri: string;
}

/** Opens camera/gallery, compresses the result and stores it. Returns null when cancelled. */
export async function pickPhoto(source: PhotoSource, opts: { aspect?: [number, number]; edit?: boolean } = {}): Promise<PickedPhoto | null> {
  const permission =
    source === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted && source === 'camera') {
    throw new Error('Necesitamos permiso de cámara para tomar la foto.');
  }
  const options: ImagePicker.ImagePickerOptions = {
    mediaTypes: ['images'],
    quality: 1,
    allowsEditing: opts.edit ?? false,
    aspect: opts.aspect,
  };
  const result = await withExternalActivity(() =>
    source === 'camera' ? ImagePicker.launchCameraAsync(options) : ImagePicker.launchImageLibraryAsync(options),
  );
  if (result.canceled || !result.assets?.[0]) return null;
  return storePhoto(result.assets[0].uri, result.assets[0].width, result.assets[0].height);
}

export async function pickPhotos(limit: number): Promise<PickedPhoto[]> {
  const result = await withExternalActivity(() =>
    ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: limit,
      quality: 1,
    }),
  );
  if (result.canceled) return [];
  const out: PickedPhoto[] = [];
  for (const a of result.assets.slice(0, limit)) out.push(await storePhoto(a.uri, a.width, a.height));
  return out;
}

export async function storePhoto(sourceUri: string, width?: number, height?: number): Promise<PickedPhoto> {
  const ctx = ImageManipulator.manipulate(sourceUri);
  if (width && height && Math.max(width, height) > MAX_SIDE) {
    ctx.resize(width >= height ? { width: MAX_SIDE } : { height: MAX_SIDE });
  } else if (!width || !height) {
    ctx.resize({ width: MAX_SIDE });
  }
  const image = await ctx.renderAsync();
  const saved = await image.saveAsync({ compress: QUALITY, format: SaveFormat.JPEG });
  const name = `${newId()}.jpg`;
  const target = new File(photoDir(), name);
  new File(saved.uri).moveSync(target);
  return { path: `${PHOTO_DIR}/${name}`, uri: target.uri };
}

/* ------------------------------ Documents ------------------------------ */
/*
 * Records can also carry documents (invoice PDF, warranty in Word…). They are stored next to the
 * photos, so backups and restores carry them unchanged, as "photos/<id>--<original name>".
 */
/** Lets the user pick any document and stores a copy. Returns null when cancelled. */
export async function pickDocument(): Promise<PickedPhoto | null> {
  // the document picker gives the real file name ("Factura.pdf"); content URIs only carry an id
  const picked = await withExternalActivity(() => DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true, multiple: false }));
  const asset = picked.canceled ? null : picked.assets?.[0];
  if (!asset) return null;
  const cached = new File(asset.uri);
  if ((asset.size ?? cached.size) > MAX_DOCUMENT_MB * 1024 * 1024) {
    if (cached.exists) cached.delete();
    throw new Error(`El archivo pesa más de ${MAX_DOCUMENT_MB} MB. Elegí uno más liviano.`);
  }
  const name = `${newId()}${DOC_SEPARATOR}${documentFileName(asset.name, asset.mimeType)}`;
  const target = new File(photoDir(), name);
  cached.moveSync(target);
  return { path: `${PHOTO_DIR}/${name}`, uri: target.uri };
}

/** Opens a stored document with an app of the phone (PDF viewer, Word…). */
export async function openAttachment(path: string): Promise<void> {
  const stored = new File(Paths.document, path);
  if (!stored.exists) throw new Error('El archivo ya no está en el teléfono.');
  const mimeType = attachmentMime(path);
  // viewers title the file by its name: hand them a temporary copy named like the original
  const openDir = new Directory(Paths.cache, 'abiertos');
  if (openDir.exists) openDir.delete();
  openDir.create({ intermediates: true });
  const file = new File(openDir, attachmentName(path));
  await stored.copy(file);
  if (!(await file.canPreview({ mimeType }))) throw new Error('No hay ninguna app en el teléfono para abrir este tipo de archivo.');
  await withExternalActivity(() => file.preview({ title: attachmentName(path), mimeType }));
}

export function deletePhotoFiles(paths: (string | null | undefined)[]): void {
  for (const p of paths) {
    if (!p || /^(content|https?):/.test(p)) continue;
    try {
      const f = new File(Paths.document, p);
      if (f.exists) f.delete();
    } catch {
      // best effort — orphaned files are harmless
    }
  }
}

export function listPhotoFiles(): File[] {
  const dir = new Directory(Paths.document, PHOTO_DIR);
  if (!dir.exists) return [];
  return dir.list().filter((e): e is File => e instanceof File);
}
