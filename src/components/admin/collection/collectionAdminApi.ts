import { AdminApiError, adminRequest, sendAdminJson } from '../adminApi';
import type { ImageSizes, PreparedImage } from './prepareImage';

/**
 * Panelin görsel koleksiyonu istemcisi (`server/admin/collection.ts`). Galeri ve sertifikalar aynı uçları kullanır,
 * yalnızca yol (`/api/admin/<id>`), metinler (`admin` çevirisinin `<id>.*` anahtarları) ve görsel boyutları değişir.
 */
export type AdminCollectionId = 'gallery' | 'certificates';

export type AdminCollection = {
  id: AdminCollectionId;
  image: ImageSizes;
  /** Listedeki küçük görselin oranı: fotoğraflar yatay, belgeler dikey kırpılır. */
  thumbShape: 'landscape' | 'portrait';
};

export const GALLERY_COLLECTION: AdminCollection = {
  id: 'gallery',
  image: { fullMaxEdge: 2000, thumbMaxEdge: 480, quality: { full: 0.86, thumb: 0.8 } },
  thumbShape: 'landscape',
};

// Belgelerdeki küçük yazılar tam ekranda okunabilsin diye büyük görsel daha büyük ve daha az sıkıştırılmıştır.
// Küçük görsel sitedeki önizleme içindir, yüksek yoğunluklu ekranda ~450 px genişliğe yeter.
export const CERTIFICATES_COLLECTION: AdminCollection = {
  id: 'certificates',
  image: { fullMaxEdge: 2800, thumbMaxEdge: 960, quality: { full: 0.9, thumb: 0.84 } },
  thumbShape: 'portrait',
};

export type LocalizedText = { tr: string; en: string };

export type ItemText = { title: LocalizedText; description: LocalizedText };

export type AdminItem = ItemText & {
  id: string;
  contentType: string;
  width: number;
  height: number;
  size: number;
  url: string;
  thumbUrl: string;
  createdAt: string;
  updatedAt: string;
};

type UploadTicket = {
  id: string;
  uploadUrls: { full: string; thumb: string };
  headers: Record<string, string>;
};

export async function fetchItems(collection: AdminCollection): Promise<AdminItem[]> {
  const { items } = await adminRequest<{ items: AdminItem[] }>(`/${collection.id}`);
  return items;
}

/** Dosyayı imzalı adrese doğrudan R2'ye yükler. İlerleme için `fetch` yerine XHR kullanılır. */
function putToStorage(url: string, blob: Blob, headers: Record<string, string>, onProgress: (loaded: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    for (const [key, value] of Object.entries(headers)) xhr.setRequestHeader(key, value);
    xhr.upload.onprogress = (event) => onProgress(event.loaded);
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new AdminApiError('unknown')));
    xhr.onerror = () => reject(new AdminApiError('unknown'));
    xhr.send(blob);
  });
}

/**
 * Yükleme: imzalı adresleri alır, iki görseli R2'ye yükler, sonra kaydı oluşturur.
 * `onProgress` 0–1 arası toplam yükleme oranını verir.
 */
export async function uploadItem(
  collection: AdminCollection,
  image: PreparedImage,
  text: ItemText,
  onProgress: (ratio: number) => void,
): Promise<AdminItem> {
  const ticket = await sendAdminJson<UploadTicket>('POST', `/${collection.id}/uploads`, {
    contentType: image.contentType,
  });

  const total = image.full.size + image.thumb.size;
  const loaded = { full: 0, thumb: 0 };
  const report = () => onProgress(total === 0 ? 1 : (loaded.full + loaded.thumb) / total);

  await Promise.all([
    putToStorage(ticket.uploadUrls.full, image.full, ticket.headers, (value) => {
      loaded.full = value;
      report();
    }),
    putToStorage(ticket.uploadUrls.thumb, image.thumb, ticket.headers, (value) => {
      loaded.thumb = value;
      report();
    }),
  ]);

  const { item } = await sendAdminJson<{ item: AdminItem }>('POST', `/${collection.id}`, {
    id: ticket.id,
    contentType: image.contentType,
    width: image.width,
    height: image.height,
    ...text,
  });
  return item;
}

export async function updateItem(collection: AdminCollection, id: string, text: ItemText): Promise<AdminItem> {
  const { item } = await sendAdminJson<{ item: AdminItem }>('PATCH', `/${collection.id}/${id}`, text);
  return item;
}

export async function deleteItem(collection: AdminCollection, id: string): Promise<void> {
  await sendAdminJson('DELETE', `/${collection.id}/${id}`);
}
