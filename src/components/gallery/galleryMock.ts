import type { GalleryImage } from './galleryApi';

// Yalnızca geliştirmede, API adresi tanımlı değilken kullanılır. Yayın paketine girmez (galleryApi'deki DEV koşulu).
// Görseller tarayıcıda çizilir: proje dosyalarına görsel eklenmez, gerçek fotoğraf gibi görünmez.

const COUNT = 48;
// Karışık oranlar: yatay, dikey, kare ve panorama. Silindir hepsini aynı panele kırpar, tam ekran görünüm tam gösterir.
const RATIOS = [3 / 2, 4 / 3, 2 / 3, 1, 16 / 9, 3 / 4, 21 / 9, 4 / 5];
// Nötr tonlar: kâğıt zeminde birbirinden ayrışsın, vurgu rengiyle yarışmasın.
const TONES = ['#2b2d2f', '#4a4e52', '#6d6a63', '#8b857a', '#3d4743', '#57514a', '#1f2326', '#7a7f84'];

function drawPlaceholder(index: number, width: number, height: number, tone: string): Promise<string> {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) return Promise.resolve('');

  context.fillStyle = tone;
  context.fillRect(0, 0, width, height);

  // Oran ve yön kolay okunsun diye ince çerçeve ve köşegenler.
  context.strokeStyle = 'rgb(255 255 255 / 0.14)';
  context.lineWidth = Math.max(2, width / 400);
  context.strokeRect(width * 0.04, height * 0.04, width * 0.92, height * 0.92);
  context.beginPath();
  context.moveTo(width * 0.04, height * 0.04);
  context.lineTo(width * 0.96, height * 0.96);
  context.moveTo(width * 0.96, height * 0.04);
  context.lineTo(width * 0.04, height * 0.96);
  context.stroke();

  const size = Math.min(width, height) * 0.34;
  context.fillStyle = 'rgb(255 255 255 / 0.9)';
  context.font = `800 ${size}px 'Saira Variable', 'Arial Narrow', sans-serif`;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(String(index + 1).padStart(3, '0'), width / 2, height / 2);

  context.font = `500 ${size * 0.16}px 'Geist Variable', Arial, sans-serif`;
  context.fillStyle = 'rgb(255 255 255 / 0.6)';
  context.fillText(`[YER TUTUCU] ${width}×${height}`, width / 2, height / 2 + size * 0.62);

  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob ? URL.createObjectURL(blob) : ''), 'image/jpeg', 0.86);
  });
}

let cache: Promise<GalleryImage[]> | null = null;

export function createMockGallery(): Promise<GalleryImage[]> {
  cache ??= Promise.all(
    Array.from({ length: COUNT }, async (_, index) => {
      const ratio = RATIOS[index % RATIOS.length];
      const tone = TONES[(index * 5) % TONES.length];
      const width = ratio >= 1 ? 1600 : Math.round(1600 * ratio);
      const height = ratio >= 1 ? Math.round(1600 / ratio) : 1600;
      const [url, thumbUrl] = await Promise.all([
        drawPlaceholder(index, width, height, tone),
        drawPlaceholder(index, Math.round(width / 6), Math.round(height / 6), tone),
      ]);
      return { id: `mock-${index}`, url, thumbUrl, width, height };
    }),
  );
  return cache;
}
