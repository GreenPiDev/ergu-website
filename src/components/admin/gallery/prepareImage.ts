/**
 * Yüklenecek fotoğrafı tarayıcıda hazırlar: EXIF yönünü uygular, iki boyuta küçültür ve WebP'ye çevirir.
 * Tarayıcı WebP üretemiyorsa (eski Safari) JPEG kullanılır. Telefondan gelen 5–10 MB'lık fotoğraflar böylece
 * birkaç yüz KB'a iner, site hızlı açılır.
 */
const FULL_MAX_EDGE = 2000;
const THUMB_MAX_EDGE = 480;
const QUALITY = { full: 0.86, thumb: 0.8 };
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
    super(`Fotoğraf hazırlanamadı: ${reason}`);
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

export async function prepareImage(file: File): Promise<PreparedImage> {
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
    let full = await render(bitmap, FULL_MAX_EDGE, contentType, QUALITY.full);
    if (full.blob?.type !== 'image/webp') {
      contentType = 'image/jpeg';
      full = await render(bitmap, FULL_MAX_EDGE, contentType, QUALITY.full);
    }
    const thumb = await render(bitmap, THUMB_MAX_EDGE, contentType, QUALITY.thumb);
    if (!full.blob || !thumb.blob || full.blob.type !== contentType || thumb.blob.type !== contentType) {
      throw new ImagePrepareError('unreadable');
    }
    return { full: full.blob, thumb: thumb.blob, contentType, width: full.width, height: full.height };
  } finally {
    bitmap.close();
  }
}
