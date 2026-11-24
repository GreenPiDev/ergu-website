import { z } from 'zod';
import { apiError, json, methodNotAllowed } from './http.js';
import { createStorage, readStorageConfig, StorageConfigError, type Storage } from './storage.js';

/**
 * Yöneticilerin yüklediği görsel koleksiyonları (fotoğraf galerisi, sertifikalar). Her koleksiyon R2'de kendi
 * klasöründe durur, ayrı veritabanı yoktur:
 *
 * - `<klasör>/index.json`: gösterim sırasıyla kayıt listesi (başlık, açıklama, ölçüler).
 * - `<klasör>/<dosya klasörü>/<id>/full.<uzantı>`: büyük görsel.
 * - `<klasör>/<dosya klasörü>/<id>/thumb.<uzantı>`: küçük görsel.
 *
 * Görseller tarayıcıda küçültülüp WebP'ye (desteklemeyen tarayıcıda JPEG'e) çevrilir, doğrudan R2'ye yüklenir.
 * Gösterilirken r2.dev kullanılmaz, sitenin kendi adresinden aktarılır: görsel adresi R2 anahtarının `/api/` altına
 * konmuş hâlidir (`gallery/photos/…` → `/api/gallery/photos/…`). Aynı alan adı olduğu için WebGL dokuları için
 * CORS da gerekmez.
 */
export type ImageCollection = {
  /** R2 klasörü ve API yolu: `/api/<name>`, `/api/admin/<name>`. */
  name: string;
  /** Görsellerin klasörü, koleksiyon klasörünün altında. */
  filesFolder: string;
  /** `index.json` içindeki listenin alan adı. Galeride mevcut veriyle uyum için `photos`. */
  listField: string;
};

export const GALLERY: ImageCollection = { name: 'gallery', filesFolder: 'photos', listField: 'photos' };
export const CERTIFICATES: ImageCollection = { name: 'certificates', filesFolder: 'images', listField: 'items' };
export const COLLECTIONS = [GALLERY, CERTIFICATES] as const;

export const TITLE_MAX = 120;
export const DESCRIPTION_MAX = 1000;

export const IMAGE_FORMATS = { 'image/webp': 'webp', 'image/jpeg': 'jpg' } as const;
export type ImageContentType = keyof typeof IMAGE_FORMATS;

const localizedText = (max: number) =>
  z.object({ tr: z.string().trim().max(max).default(''), en: z.string().trim().max(max).default('') });

export const imageTextSchema = z.object({
  title: localizedText(TITLE_MAX),
  description: localizedText(DESCRIPTION_MAX),
});

const itemSchema = imageTextSchema.extend({
  id: z.string(),
  contentType: z.enum(['image/webp', 'image/jpeg']),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  size: z.number().int().nonnegative(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const manifestSchema = z.object({ version: z.literal(1) }).loose();

export type CollectionItem = z.infer<typeof itemSchema>;

export function manifestKey(collection: ImageCollection): string {
  return `${collection.name}/index.json`;
}

export function imageKeys(collection: ImageCollection, id: string, contentType: ImageContentType) {
  const extension = IMAGE_FORMATS[contentType];
  const folder = `${collection.name}/${collection.filesFolder}/${id}`;
  return { full: `${folder}/full.${extension}`, thumb: `${folder}/thumb.${extension}` };
}

export async function readItems(
  storage: Storage,
  collection: ImageCollection,
): Promise<{ items: CollectionItem[]; etag: string | null }> {
  const stored = await storage.getJson(manifestKey(collection));
  if (!stored) return { items: [], etag: null };
  const manifest = manifestSchema.parse(stored.data);
  return { items: z.array(itemSchema).parse(manifest[collection.listField] ?? []), etag: stored.etag };
}

const MAX_WRITE_ATTEMPTS = 4;

/**
 * Listeyi okur, `change` ile değiştirir ve koşullu yazar. Arada başka bir istek listeyi değiştirdiyse baştan okur.
 * `change` `null` dönerse yazmadan çıkar (ör. kayıt bulunamadı).
 */
export async function updateItems<T>(
  storage: Storage,
  collection: ImageCollection,
  change: (items: CollectionItem[]) => { items: CollectionItem[]; result: T } | null,
): Promise<T | null> {
  for (let attempt = 0; attempt < MAX_WRITE_ATTEMPTS; attempt += 1) {
    const { items, etag } = await readItems(storage, collection);
    const changed = change(structuredClone(items));
    if (!changed) return null;
    const manifest = { version: 1, [collection.listField]: changed.items };
    if ((await storage.putJson(manifestKey(collection), manifest, etag)) === 'ok') return changed.result;
  }
  throw new Error(`${collection.name} listesi art arda çakışma nedeniyle yazılamadı.`);
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

const FILE_URL_PREFIX = '/api/';
// Kimliği her görsele özel olduğu için dosyalar değişmez. `s-maxage`, Vercel CDN'inin yanıtı saklaması içindir:
// her görsel fonksiyondan bir kez geçer.
const IMAGE_FILE_CACHE_CONTROL = 'public, max-age=31536000, s-maxage=31536000, immutable';
const FORWARDED_FILE_HEADERS = ['content-type', 'content-length', 'etag', 'last-modified'];

function filePattern(collection: ImageCollection): RegExp {
  return new RegExp(
    `^/api/(${collection.name}/${collection.filesFolder}/[0-9a-f-]{36}/(?:full|thumb)\\.(?:webp|jpg))$`,
  );
}

function imageUrls(collection: ImageCollection, item: CollectionItem) {
  const keys = imageKeys(collection, item.id, item.contentType);
  return { url: `${FILE_URL_PREFIX}${keys.full}`, thumbUrl: `${FILE_URL_PREFIX}${keys.thumb}` };
}

/** Panelin gördüğü kayıt: kayıt ve görsel adresleri. */
export function toAdminItem(collection: ImageCollection, item: CollectionItem) {
  return { ...item, ...imageUrls(collection, item) };
}

/** `pathname` bir koleksiyonun görsel dosyası adresiyse o koleksiyon (`server/api.ts` yönlendirmesi için). */
export function findFileCollection(pathname: string): ImageCollection | undefined {
  return COLLECTIONS.find((collection) => filePattern(collection).test(pathname));
}

/** `pathname` bir koleksiyonun herkese açık listesiyse (`/api/<name>`) o koleksiyon. */
export function findListCollection(pathname: string): ImageCollection | undefined {
  return COLLECTIONS.find((collection) => pathname === `/api/${collection.name}`);
}

/**
 * Görsel dosyasını R2'den okuyup aktarır. Yalnızca koleksiyonun dosya kalıbına uyan anahtarlar kabul edilir,
 * bucket'ın geri kalanına bu uçtan erişilemez.
 */
export async function handleImageFile(
  request: Request,
  collection: ImageCollection,
  pathname: string,
): Promise<Response> {
  const method = request.method.toUpperCase();
  if (method !== 'GET' && method !== 'HEAD') return methodNotAllowed(['GET', 'HEAD']);
  const key = filePattern(collection).exec(pathname)?.[1];
  if (!key) return apiError('not_found', 404);
  const storage = getStorage();
  if (!storage) return apiError('storage_not_configured', 500);

  const stored = await storage.getObject(key, method, request.headers.get('if-none-match'));
  if (!stored) return apiError('not_found', 404);

  const headers = new Headers({ 'Cache-Control': IMAGE_FILE_CACHE_CONTROL, 'X-Content-Type-Options': 'nosniff' });
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
 * Site için herkese açık liste: `GET /api/<name>`. Biçim sitedeki istemcilerin sözleşmesiyle aynıdır
 * (`src/components/gallery/galleryApi.ts`, `src/components/certificates/certificatesApi.ts`). `alt` önce başlıktan,
 * yoksa açıklamadan gelir. Kısa süre CDN önbelleğinde tutulur.
 */
export async function handlePublicList(request: Request, collection: ImageCollection): Promise<Response> {
  if (request.method.toUpperCase() !== 'GET') return methodNotAllowed(['GET']);
  const storage = getStorage();
  if (!storage) return apiError('storage_not_configured', 500);

  const { items } = await readItems(storage, collection);
  const images = items.map((item) => ({
    id: item.id,
    ...imageUrls(collection, item),
    width: item.width,
    height: item.height,
    alt: { tr: item.title.tr || item.description.tr, en: item.title.en || item.description.en },
    title: item.title,
    description: item.description,
  }));
  return json({ images }, 200, { 'Cache-Control': 'public, max-age=0, s-maxage=60, stale-while-revalidate=600' });
}
