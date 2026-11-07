import { Directory, File, Paths } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

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
