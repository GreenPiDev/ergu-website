import { z } from 'zod';
import { apiError, json, methodNotAllowed } from './http.js';
import { createStorage, readStorageConfig, StorageConfigError, type Storage } from './storage.js';

/**
 * Fotoğraf galerisinin verisi. Fotoğraflar ve galeri listesi R2'de durur, ayrı veritabanı yoktur:
 *
 * - `gallery/index.json`: gösterim sırasıyla fotoğraf listesi (başlık, açıklama, ölçüler).
 * - `gallery/photos/<id>/full.<uzantı>`: büyük görsel (uzun kenar en fazla 2000 px).
 * - `gallery/photos/<id>/thumb.<uzantı>`: küçük görsel (uzun kenar en fazla 480 px).
 *
 * Görseller tarayıcıda küçültülüp WebP'ye (desteklemeyen tarayıcıda JPEG'e) çevrilir, doğrudan R2'ye yüklenir.
 */
export const MANIFEST_KEY = 'gallery/index.json';
export const TITLE_MAX = 120;
export const DESCRIPTION_MAX = 1000;

export const PHOTO_FORMATS = { 'image/webp': 'webp', 'image/jpeg': 'jpg' } as const;
export type PhotoContentType = keyof typeof PHOTO_FORMATS;

const localizedText = (max: number) =>
  z.object({ tr: z.string().trim().max(max).default(''), en: z.string().trim().max(max).default('') });

export const photoTextSchema = z.object({
  title: localizedText(TITLE_MAX),
  description: localizedText(DESCRIPTION_MAX),
});

const photoSchema = photoTextSchema.extend({
  id: z.string(),
  contentType: z.enum(['image/webp', 'image/jpeg']),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  size: z.number().int().nonnegative(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const manifestSchema = z.object({ version: z.literal(1), photos: z.array(photoSchema) });

export type GalleryPhoto = z.infer<typeof photoSchema>;
export type GalleryManifest = z.infer<typeof manifestSchema>;

export function photoKeys(id: string, contentType: PhotoContentType) {
  const extension = PHOTO_FORMATS[contentType];
  return { full: `gallery/photos/${id}/full.${extension}`, thumb: `gallery/photos/${id}/thumb.${extension}` };
}

export async function readManifest(storage: Storage): Promise<{ manifest: GalleryManifest; etag: string | null }> {
  const stored = await storage.getJson(MANIFEST_KEY);
  if (!stored) return { manifest: { version: 1, photos: [] }, etag: null };
  return { manifest: manifestSchema.parse(stored.data), etag: stored.etag };
}

const MAX_WRITE_ATTEMPTS = 4;

/**
 * Listeyi okur, `change` ile değiştirir ve koşullu yazar. Arada başka bir istek listeyi değiştirdiyse baştan okur.
 * `change` `null` dönerse yazmadan çıkar (ör. fotoğraf bulunamadı).
 */
export async function updateManifest<T>(
  storage: Storage,
  change: (manifest: GalleryManifest) => { manifest: GalleryManifest; result: T } | null,
): Promise<T | null> {
  for (let attempt = 0; attempt < MAX_WRITE_ATTEMPTS; attempt += 1) {
    const { manifest, etag } = await readManifest(storage);
    const changed = change(structuredClone(manifest));
    if (!changed) return null;
    if ((await storage.putJson(MANIFEST_KEY, changed.manifest, etag)) === 'ok') return changed.result;
  }
  throw new Error('Galeri listesi art arda çakışma nedeniyle yazılamadı.');
}

/** Ayarlar eksikse `null`: çağıran `storage_not_configured` döner. */
export function getStorage(): Storage | null {
  try {
    return createStorage(readStorageConfig());
  } catch (cause) {
    if (cause instanceof StorageConfigError) return null;
    throw cause;
  }
}

function photoUrls(storage: Storage, photo: GalleryPhoto) {
  const keys = photoKeys(photo.id, photo.contentType);
  return { url: storage.publicUrl(keys.full), thumbUrl: storage.publicUrl(keys.thumb) };
}

/** Panelin gördüğü fotoğraf: kayıt ve herkese açık adresleri. */
export function toAdminPhoto(storage: Storage, photo: GalleryPhoto) {
  return { ...photo, ...photoUrls(storage, photo) };
}

/**
 * Sitenin galeri sayfası için herkese açık liste: `GET /api/gallery`. Biçim `src/components/gallery/galleryApi.ts`
 * içindeki sözleşmeyle aynıdır. `alt` önce başlıktan, yoksa açıklamadan gelir. Kısa süre CDN önbelleğinde tutulur.
 */
export async function handlePublicGallery(request: Request): Promise<Response> {
  if (request.method.toUpperCase() !== 'GET') return methodNotAllowed(['GET']);
  const storage = getStorage();
  if (!storage) return apiError('storage_not_configured', 500);

  const { manifest } = await readManifest(storage);
  const images = manifest.photos.map((photo) => ({
    id: photo.id,
    ...photoUrls(storage, photo),
    width: photo.width,
    height: photo.height,
    alt: { tr: photo.title.tr || photo.description.tr, en: photo.title.en || photo.description.en },
    title: photo.title,
    description: photo.description,
  }));
  return json({ images }, 200, { 'Cache-Control': 'public, max-age=0, s-maxage=60, stale-while-revalidate=600' });
}
