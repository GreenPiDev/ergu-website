import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { apiError, json, methodNotAllowed, readJsonBody } from '../http.js';
import {
  getStorage,
  IMAGE_FORMATS,
  imageKeys,
  imageTextSchema,
  readItems,
  toAdminItem,
  updateItems,
  type CollectionItem,
  type ImageCollection,
} from '../imageCollection.js';
import type { Storage } from '../storage.js';

/**
 * Panelin görsel koleksiyonu uçları (oturum `handler.ts` içinde doğrulanır). `<name>` koleksiyonun adıdır
 * (`gallery`, `certificates`):
 *
 * - `GET    /api/admin/<name>`          → kayıt listesi
 * - `POST   /api/admin/<name>/uploads`  { contentType } → yeni kimlik ve iki imzalı yükleme adresi (büyük, küçük)
 * - `POST   /api/admin/<name>`          { id, contentType, width, height, title, description } → listeye ekler
 * - `PATCH  /api/admin/<name>/:id`      { title, description } → metinleri günceller
 * - `DELETE /api/admin/<name>/:id`      → listeden ve R2'den siler
 *
 * Yükleme iki adımlıdır: tarayıcı dosyaları imzalı adreslere doğrudan yükler (Vercel'in istek boyutu sınırına
 * takılmaz), sonra kaydı oluşturur. Sunucu kayıttan önce dosyaların R2'de olduğunu doğrular.
 */
const UPLOAD_URL_TTL_SECONDS = 10 * 60;
const MAX_FULL_BYTES = 15 * 1024 * 1024;
const MAX_THUMB_BYTES = 2 * 1024 * 1024;
const MAX_DIMENSION = 4096;
// Kimliği her görsele özel olduğu için dosyalar değişmez, tarayıcı ve CDN süresiz önbelleğe alabilir.
const IMAGE_CACHE_CONTROL = 'public, max-age=31536000, immutable';

const contentTypeSchema = z.enum(Object.keys(IMAGE_FORMATS) as [keyof typeof IMAGE_FORMATS]);
const idSchema = z.uuid();

const uploadRequestSchema = z.object({ contentType: contentTypeSchema });

const createItemSchema = imageTextSchema.extend({
  id: idSchema,
  contentType: contentTypeSchema,
  width: z.number().int().positive().max(MAX_DIMENSION),
  height: z.number().int().positive().max(MAX_DIMENSION),
});

async function createUpload(request: Request, storage: Storage, collection: ImageCollection): Promise<Response> {
  const parsed = uploadRequestSchema.safeParse(await readJsonBody(request));
  if (!parsed.success) return apiError('invalid_request', 400);

  const { contentType } = parsed.data;
  const id = randomUUID();
  const keys = imageKeys(collection, id, contentType);
  const headers = { 'Content-Type': contentType, 'Cache-Control': IMAGE_CACHE_CONTROL };
  const [full, thumb] = await Promise.all([
    storage.presignPut(keys.full, headers, UPLOAD_URL_TTL_SECONDS),
    storage.presignPut(keys.thumb, headers, UPLOAD_URL_TTL_SECONDS),
  ]);
  return json({ id, uploadUrls: { full, thumb }, headers });
}

async function createItem(request: Request, storage: Storage, collection: ImageCollection): Promise<Response> {
  const parsed = createItemSchema.safeParse(await readJsonBody(request));
  if (!parsed.success) return apiError('invalid_request', 400);

  const { id, contentType, width, height, title, description } = parsed.data;
  const keys = imageKeys(collection, id, contentType);
  const [full, thumb] = await Promise.all([storage.head(keys.full), storage.head(keys.thumb)]);

  const isValid =
    full !== null &&
    thumb !== null &&
    full.contentType === contentType &&
    thumb.contentType === contentType &&
    full.size <= MAX_FULL_BYTES &&
    thumb.size <= MAX_THUMB_BYTES;
  if (!isValid) {
    // Eksik veya kurallara uymayan yükleme geride dosya bırakmasın.
    await Promise.all([storage.delete(keys.full), storage.delete(keys.thumb)]);
    return apiError('upload_incomplete', 400);
  }

  const now = new Date().toISOString();
  const item: CollectionItem = {
    id,
    contentType,
    width,
    height,
    size: full.size,
    title,
    description,
    createdAt: now,
    updatedAt: now,
  };
  const saved = await updateItems(storage, collection, (items) => {
    if (items.some((existing) => existing.id === id)) return null;
    // Yeni kayıt listenin başına eklenir.
    return { items: [item, ...items], result: item };
  });
  if (!saved) return apiError('conflict', 409);
  return json({ item: toAdminItem(collection, saved) }, 201);
}

async function updateItem(
  request: Request,
  storage: Storage,
  collection: ImageCollection,
  id: string,
): Promise<Response> {
  const parsed = imageTextSchema.safeParse(await readJsonBody(request));
  if (!parsed.success) return apiError('invalid_request', 400);

  const updated = await updateItems(storage, collection, (items) => {
    const index = items.findIndex((item) => item.id === id);
    if (index === -1) return null;
    const item = { ...items[index], ...parsed.data, updatedAt: new Date().toISOString() };
    items[index] = item;
    return { items, result: item };
  });
  return updated ? json({ item: toAdminItem(collection, updated) }) : apiError('not_found', 404);
}

async function deleteItem(storage: Storage, collection: ImageCollection, id: string): Promise<Response> {
  const removed = await updateItems(storage, collection, (items) => {
    const item = items.find((existing) => existing.id === id);
    if (!item) return null;
    return { items: items.filter((existing) => existing.id !== id), result: item };
  });
  if (!removed) return apiError('not_found', 404);

  // Önce listeden çıkarılır, sitede hemen görünmez olur; dosyalar ardından silinir.
  const keys = imageKeys(collection, removed.id, removed.contentType);
  await Promise.all([storage.delete(keys.full), storage.delete(keys.thumb)]);
  return json({ ok: true });
}

/** `subPath`, `/api/admin/<name>` sonrasındaki kısımdır: '', '/uploads' veya '/<id>'. */
export async function handleAdminCollection(
  request: Request,
  collection: ImageCollection,
  method: string,
  subPath: string,
): Promise<Response> {
  const storage = getStorage();
  if (!storage) return apiError('storage_not_configured', 500);

  if (subPath === '') {
    if (method === 'GET') {
      const { items } = await readItems(storage, collection);
      return json({ items: items.map((item) => toAdminItem(collection, item)) });
    }
    if (method === 'POST') return createItem(request, storage, collection);
    return methodNotAllowed(['GET', 'POST']);
  }

  if (subPath === '/uploads') {
    return method === 'POST' ? createUpload(request, storage, collection) : methodNotAllowed(['POST']);
  }

  const id = idSchema.safeParse(subPath.slice(1));
  if (!id.success) return apiError('not_found', 404);
  if (method === 'PATCH') return updateItem(request, storage, collection, id.data);
  if (method === 'DELETE') return deleteItem(storage, collection, id.data);
  return methodNotAllowed(['PATCH', 'DELETE']);
}
