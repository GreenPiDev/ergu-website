import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import {
  getStorage,
  PHOTO_FORMATS,
  photoKeys,
  photoTextSchema,
  readManifest,
  toAdminPhoto,
  updateManifest,
  type GalleryPhoto,
} from '../gallery.js';
import { apiError, json, methodNotAllowed, readJsonBody } from '../http.js';
import type { Storage } from '../storage.js';

/**
 * Panelin galeri uçları (oturum `handler.ts` içinde doğrulanır):
 *
 * - `GET    /api/admin/gallery`          → fotoğraf listesi
 * - `POST   /api/admin/gallery/uploads`  { contentType } → yeni kimlik ve iki imzalı yükleme adresi (büyük, küçük)
 * - `POST   /api/admin/gallery`          { id, contentType, width, height, title, description } → listeye ekler
 * - `PATCH  /api/admin/gallery/:id`      { title, description } → metinleri günceller
 * - `DELETE /api/admin/gallery/:id`      → listeden ve R2'den siler
 *
 * Yükleme iki adımlıdır: tarayıcı dosyaları imzalı adreslere doğrudan yükler (Vercel'in istek boyutu sınırına
 * takılmaz), sonra kaydı oluşturur. Sunucu kayıttan önce dosyaların R2'de olduğunu doğrular.
 */
const UPLOAD_URL_TTL_SECONDS = 10 * 60;
const MAX_FULL_BYTES = 15 * 1024 * 1024;
const MAX_THUMB_BYTES = 2 * 1024 * 1024;
const MAX_DIMENSION = 4096;
// Kimliği her fotoğrafa özel olduğu için dosyalar değişmez, tarayıcı ve CDN süresiz önbelleğe alabilir.
const IMAGE_CACHE_CONTROL = 'public, max-age=31536000, immutable';

const contentTypeSchema = z.enum(Object.keys(PHOTO_FORMATS) as [keyof typeof PHOTO_FORMATS]);
const idSchema = z.uuid();

const uploadRequestSchema = z.object({ contentType: contentTypeSchema });

const createPhotoSchema = photoTextSchema.extend({
  id: idSchema,
  contentType: contentTypeSchema,
  width: z.number().int().positive().max(MAX_DIMENSION),
  height: z.number().int().positive().max(MAX_DIMENSION),
});

async function createUpload(request: Request, storage: Storage): Promise<Response> {
  const parsed = uploadRequestSchema.safeParse(await readJsonBody(request));
  if (!parsed.success) return apiError('invalid_request', 400);

  const { contentType } = parsed.data;
  const id = randomUUID();
  const keys = photoKeys(id, contentType);
  const headers = { 'Content-Type': contentType, 'Cache-Control': IMAGE_CACHE_CONTROL };
  const [full, thumb] = await Promise.all([
    storage.presignPut(keys.full, headers, UPLOAD_URL_TTL_SECONDS),
    storage.presignPut(keys.thumb, headers, UPLOAD_URL_TTL_SECONDS),
  ]);
  return json({ id, uploadUrls: { full, thumb }, headers });
}

async function createPhoto(request: Request, storage: Storage): Promise<Response> {
  const parsed = createPhotoSchema.safeParse(await readJsonBody(request));
  if (!parsed.success) return apiError('invalid_request', 400);

  const { id, contentType, width, height, title, description } = parsed.data;
  const keys = photoKeys(id, contentType);
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
  const photo: GalleryPhoto = {
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
  const saved = await updateManifest(storage, (manifest) => {
    if (manifest.photos.some((item) => item.id === id)) return null;
    // Yeni fotoğraf listenin başına eklenir.
    return { manifest: { ...manifest, photos: [photo, ...manifest.photos] }, result: photo };
  });
  if (!saved) return apiError('conflict', 409);
  return json({ photo: toAdminPhoto(saved) }, 201);
}

async function updatePhoto(request: Request, storage: Storage, id: string): Promise<Response> {
  const parsed = photoTextSchema.safeParse(await readJsonBody(request));
  if (!parsed.success) return apiError('invalid_request', 400);

  const updated = await updateManifest(storage, (manifest) => {
    const index = manifest.photos.findIndex((photo) => photo.id === id);
    if (index === -1) return null;
    const photo = { ...manifest.photos[index], ...parsed.data, updatedAt: new Date().toISOString() };
    manifest.photos[index] = photo;
    return { manifest, result: photo };
  });
  return updated ? json({ photo: toAdminPhoto(updated) }) : apiError('not_found', 404);
}

async function deletePhoto(storage: Storage, id: string): Promise<Response> {
  const removed = await updateManifest(storage, (manifest) => {
    const photo = manifest.photos.find((item) => item.id === id);
    if (!photo) return null;
    return { manifest: { ...manifest, photos: manifest.photos.filter((item) => item.id !== id) }, result: photo };
  });
  if (!removed) return apiError('not_found', 404);

  // Önce listeden çıkarılır, sitede hemen görünmez olur; dosyalar ardından silinir.
  const keys = photoKeys(removed.id, removed.contentType);
  await Promise.all([storage.delete(keys.full), storage.delete(keys.thumb)]);
  return json({ ok: true });
}

/** `subPath`, `/api/admin/gallery` sonrasındaki kısımdır: '', '/uploads' veya '/<id>'. */
export async function handleAdminGallery(request: Request, method: string, subPath: string): Promise<Response> {
  const storage = getStorage();
  if (!storage) return apiError('storage_not_configured', 500);

  if (subPath === '') {
    if (method === 'GET') {
      const { manifest } = await readManifest(storage);
      return json({ photos: manifest.photos.map(toAdminPhoto) });
    }
    if (method === 'POST') return createPhoto(request, storage);
    return methodNotAllowed(['GET', 'POST']);
  }

  if (subPath === '/uploads') {
    return method === 'POST' ? createUpload(request, storage) : methodNotAllowed(['POST']);
  }

  const id = idSchema.safeParse(subPath.slice(1));
  if (!id.success) return apiError('not_found', 404);
  if (method === 'PATCH') return updatePhoto(request, storage, id.data);
  if (method === 'DELETE') return deletePhoto(storage, id.data);
  return methodNotAllowed(['PATCH', 'DELETE']);
}
