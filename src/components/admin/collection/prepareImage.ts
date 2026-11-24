/**
 * Yüklenecek görseli tarayıcıda hazırlar: EXIF yönünü uygular, iki boyuta küçültür ve WebP'ye çevirir.
 * Tarayıcı WebP üretemiyorsa (eski Safari) JPEG kullanılır. Telefondan gelen 5–10 MB'lık fotoğraflar böylece
 * birkaç yüz KB'a iner, site hızlı açılır. Boyutlar koleksiyona göre değişir (`collectionAdminApi.ts`).
 */
export type ImageSizes = {
  /** Büyük görselin uzun kenarı en fazla (px). Sunucu sınırı 4096 px'tir. */
  fullMaxEdge: number;
  thumbMaxEdge: number;
  quality: { full: number; thumb: number };
};
/** Ham dosya için üst sınır: bundan büyük dosyalar tarayıcıyı zorlamasın diye hiç işlenmez. */
export const MAX_SOURCE_BYTES = 40 * 1024 * 1024;

export type PreparedImage = {
  full: Blob;
  thumb: Blob;
  contentType: 'image/webp' | 'image/jpeg';
  width: number;
  height: number;
};

export class ImagePrepareError extends Error {
  readonly reason: 'tooLarge' | 'unreadable';

  constructor(reason: 'tooLarge' | 'unreadable') {
    super(`Görsel hazırlanamadı: ${reason}`);
    this.reason = reason;
  }
}

function fitWithin(width: number, height: number, maxEdge: number) {
  const scale = Math.min(1, maxEdge / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

function encode(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

async function render(bitmap: ImageBitmap, maxEdge: number, type: PreparedImage['contentType'], quality: number) {
  const size = fitWithin(bitmap.width, bitmap.height, maxEdge);
  const canvas = document.createElement('canvas');
  canvas.width = size.width;
  canvas.height = size.height;
  const context = canvas.getContext('2d');
  if (!context) throw new ImagePrepareError('unreadable');
  context.imageSmoothingQuality = 'high';
  context.drawImage(bitmap, 0, 0, size.width, size.height);
  const blob = await encode(canvas, type, quality);
  return { blob, ...size };
}

export async function prepareImage(file: File, sizes: ImageSizes): Promise<PreparedImage> {
  if (file.size > MAX_SOURCE_BYTES) throw new ImagePrepareError('tooLarge');

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    throw new ImagePrepareError('unreadable');
  }

  try {
    // İstenmeyen türde dosya dönerse (WebP kodlayıcısı olmayan tarayıcı PNG verir) JPEG'e geçilir.
    let contentType: PreparedImage['contentType'] = 'image/webp';
    let full = await render(bitmap, sizes.fullMaxEdge, contentType, sizes.quality.full);
    if (full.blob?.type !== 'image/webp') {
      contentType = 'image/jpeg';
      full = await render(bitmap, sizes.fullMaxEdge, contentType, sizes.quality.full);
    }
    const thumb = await render(bitmap, sizes.thumbMaxEdge, contentType, sizes.quality.thumb);
    if (!full.blob || !thumb.blob || full.blob.type !== contentType || thumb.blob.type !== contentType) {
      throw new ImagePrepareError('unreadable');
    }
    return { full: full.blob, thumb: thumb.blob, contentType, width: full.width, height: full.height };
  } finally {
    bitmap.close();
  }
}
