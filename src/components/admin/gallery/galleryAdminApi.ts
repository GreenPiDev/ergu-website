import { AdminApiError, adminRequest, sendAdminJson } from '../adminApi';
import type { PreparedImage } from './prepareImage';

/** Panelin galeri istemcisi (`server/admin/gallery.ts`). */
export type LocalizedText = { tr: string; en: string };

export type PhotoText = { title: LocalizedText; description: LocalizedText };

export type AdminPhoto = PhotoText & {
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

export async function fetchPhotos(): Promise<AdminPhoto[]> {
  const { photos } = await adminRequest<{ photos: AdminPhoto[] }>('/gallery');
  return photos;
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
export async function uploadPhoto(
  image: PreparedImage,
  text: PhotoText,
  onProgress: (ratio: number) => void,
): Promise<AdminPhoto> {
  const ticket = await sendAdminJson<UploadTicket>('POST', '/gallery/uploads', { contentType: image.contentType });

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

  const { photo } = await sendAdminJson<{ photo: AdminPhoto }>('POST', '/gallery', {
    id: ticket.id,
    contentType: image.contentType,
    width: image.width,
    height: image.height,
    ...text,
  });
  return photo;
}

export async function updatePhoto(id: string, text: PhotoText): Promise<AdminPhoto> {
  const { photo } = await sendAdminJson<{ photo: AdminPhoto }>('PATCH', `/gallery/${id}`, text);
  return photo;
}

export async function deletePhoto(id: string): Promise<void> {
  await sendAdminJson('DELETE', `/gallery/${id}`);
}
