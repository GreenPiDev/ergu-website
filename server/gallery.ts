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
 * Gösterilirken r2.dev kullanılmaz, sitenin kendi adresinden aktarılır: `GET /api/gallery/photos/<id>/<boyut>.<uzantı>`
 * (`handlePhotoFile`). Aynı alan adı olduğu için WebGL dokuları için CORS da gerekmez.
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

// Görsel adresi, R2 anahtarının `/api/` altına konmuş hâlidir: `gallery/photos/…` → `/api/gallery/photos/…`.
const FILE_URL_PREFIX = '/api/';
const PHOTO_FILE_PATTERN = /^\/api\/(gallery\/photos\/[0-9a-f-]{36}\/(?:full|thumb)\.(?:webp|jpg))$/;
// Kimliği her fotoğrafa özel olduğu için dosyalar değişmez. `s-maxage`, Vercel CDN'inin yanıtı saklaması içindir:
// her görsel fonksiyondan bir kez geçer.
const PHOTO_FILE_CACHE_CONTROL = 'public, max-age=31536000, s-maxage=31536000, immutable';
const FORWARDED_FILE_HEADERS = ['content-type', 'content-length', 'etag', 'last-modified'];

function photoUrls(photo: GalleryPhoto) {
  const keys = photoKeys(photo.id, photo.contentType);
  return { url: `${FILE_URL_PREFIX}${keys.full}`, thumbUrl: `${FILE_URL_PREFIX}${keys.thumb}` };
}

/** Panelin gördüğü fotoğraf: kayıt ve görsel adresleri. */
export function toAdminPhoto(photo: GalleryPhoto) {
  return { ...photo, ...photoUrls(photo) };
}

/** `pathname` bir fotoğraf dosyası adresiyse true (`server/api.ts` yönlendirmesi için). */
export function isPhotoFilePath(pathname: string): boolean {
  return PHOTO_FILE_PATTERN.test(pathname);
}

/**
 * Fotoğraf dosyasını R2'den okuyup aktarır. Yalnızca galeri fotoğraflarının kalıbına uyan anahtarlar kabul edilir,
 * bucket'ın geri kalanına bu uçtan erişilemez. Galeri listesinde olmayan (ör. silinmiş) dosya da 404 döner.
 */
export async function handlePhotoFile(request: Request, pathname: string): Promise<Response> {
  const method = request.method.toUpperCase();
  if (method !== 'GET' && method !== 'HEAD') return methodNotAllowed(['GET', 'HEAD']);
  const key = PHOTO_FILE_PATTERN.exec(pathname)?.[1];
  if (!key) return apiError('not_found', 404);
  const storage = getStorage();
  if (!storage) return apiError('storage_not_configured', 500);

  const stored = await storage.getObject(key, method, request.headers.get('if-none-match'));
  if (!stored) return apiError('not_found', 404);

  const headers = new Headers({ 'Cache-Control': PHOTO_FILE_CACHE_CONTROL, 'X-Content-Type-Options': 'nosniff' });
  for (const name of FORWARDED_FILE_HEADERS) {
    const value = stored.headers.get(name);
    if (value) headers.set(name, value);
  }
  return new Response(stored.status === 304 || method === 'HEAD' ? null : stored.body, {
    status: stored.status,
    headers,
  });
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
    ...photoUrls(photo),
    width: photo.width,
    height: photo.height,
    alt: { tr: photo.title.tr || photo.description.tr, en: photo.title.en || photo.description.en },
    title: photo.title,
    description: photo.description,
  }));
  return json({ images }, 200, { 'Cache-Control': 'public, max-age=0, s-maxage=60, stale-while-revalidate=600' });
}
