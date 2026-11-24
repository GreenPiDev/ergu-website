import { z } from 'zod';

/**
 * Galeri verisi Cloudflare'deki API'den gelir, görseller proje dosyalarında tutulmaz.
 * Beklenen yanıt (`GET VITE_GALLERY_API_URL`), gösterim sırasıyla:
 *
 * {
 *   "images": [
 *     {
 *       "id": "a1b2",
 *       "url": "https://…/w=1600",      // silindir ve tam ekran görünüm (uzun kenar ~1600–2000 px)
 *       "thumbUrl": "https://…/w=240",  // alttaki şerit (uzun kenar ~240 px)
 *       "width": 4000, "height": 2667,  // orijinal oran için piksel ölçüleri
 *       "alt": { "tr": "…", "en": "…" } // isteğe bağlı, ekran okuyucular için
 *     }
 *   ]
 * }
 *
 * Görseller WebGL dokusu olarak çizilir: başka bir alan adından gelirlerse o sunucu `Access-Control-Allow-Origin`
 * göndermelidir. Kendi API'miz görselleri sitenin adresinden verdiği için (`/api/gallery/photos/…`) buna gerek yoktur.
 */
const galleryImageSchema = z.object({
  id: z.string().min(1),
  url: z.string().min(1),
  thumbUrl: z.string().min(1),
  width: z.number().positive(),
  height: z.number().positive(),
  alt: z.object({ tr: z.string().optional(), en: z.string().optional() }).partial().optional(),
});

const galleryResponseSchema = z.object({ images: z.array(galleryImageSchema) });

export type GalleryImage = z.infer<typeof galleryImageSchema>;

const API_URL: string | undefined = import.meta.env.VITE_GALLERY_API_URL;

export async function fetchGalleryImages(signal: AbortSignal): Promise<GalleryImage[]> {
  if (!API_URL) {
    // Backend hazır olana kadar geliştirmede örnek görseller üretilir, yayında boş galeri gösterilir.
    if (import.meta.env.DEV) {
      const { createMockGallery } = await import('./galleryMock');
      return createMockGallery();
    }
    return [];
  }

  const response = await fetch(API_URL, { signal, headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`Galeri yüklenemedi: ${response.status}`);
  return galleryResponseSchema.parse(await response.json()).images;
}

/** Görselin aktif dildeki açıklaması. Yoksa çağıran taraf sıra numaralı genel metni kullanır. */
export function getImageAlt(image: GalleryImage, language: string): string | undefined {
  return (language === 'en' ? image.alt?.en : image.alt?.tr)?.trim() || undefined;
}
