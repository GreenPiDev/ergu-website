import * as THREE from 'three';
import { wrapIndex } from './carouselController';
import type { GalleryImage } from './galleryApi';

interface Entry {
  texture: THREE.Texture | null;
  /** loading: iniyor; decoded: çözüldü, GPU'ya yüklenmeyi bekliyor; ready: çizilebilir. */
  status: 'loading' | 'decoded' | 'ready' | 'error';
}

// Bellekte tutulan en fazla doku. Fazlası, öndeki fotoğrafa en uzak olandan başlayarak silinir.
const MAX_TEXTURES = 64;
// ImageBitmap varsa fotoğraf ana iş parçacığının dışında çözülür; yoksa (eski tarayıcı) <img> ile yüklenir.
const supportsImageBitmap = typeof createImageBitmap !== 'undefined';

/**
 * Fotoğraf dokularını ihtiyaç oldukça yükler, uzaklaşanları bellekten atar.
 * Silindir hızla dönerken birden çok fotoğraf aynı anda iner. Hepsi aynı karede GPU'ya yüklenirse kare atlar, bu yüzden
 * her karede en fazla bir doku yüklenir (`uploadNext`) ve doku ancak yüklendikten sonra çizime girer.
 */
export class GalleryTextures {
  private readonly entries = new Map<number, Entry>();
  private readonly bitmapLoader = supportsImageBitmap
    ? new THREE.ImageBitmapLoader().setCrossOrigin('anonymous')
    : null;
  private readonly imageLoader = new THREE.TextureLoader().setCrossOrigin('anonymous');
  private disposed = false;
  private readonly images: readonly GalleryImage[];
  private readonly anisotropy: number;

  /**
   * ImageBitmap dokuları GPU'ya çevrilmeden yüklenir (flipY etkisizdir); shader'da dikeyde çevrilmeleri gerekir.
   * Çevirme çözme sırasında yapılmaz, çünkü her tarayıcı `imageOrientation: 'flipY'` seçeneğini desteklemez.
   */
  readonly flipY = supportsImageBitmap;

  constructor(images: readonly GalleryImage[], anisotropy: number) {
    this.images = images;
    this.anisotropy = anisotropy;
  }

  get(index: number): THREE.Texture | null {
    const entry = this.entries.get(index);
    return entry?.status === 'ready' ? entry.texture : null;
  }

  /** Yüklendiyse veya yüklenemediyse true: bekleyecek bir şey kalmamıştır. */
  isSettled(index: number): boolean {
    const status = this.entries.get(index)?.status;
    return status === 'ready' || status === 'error';
  }

  request(index: number) {
    if (this.entries.has(index)) return;
    const entry: Entry = { texture: null, status: 'loading' };
    this.entries.set(index, entry);
    const url = this.images[index].url;
    const onError = () => {
      entry.status = 'error';
    };

    if (this.bitmapLoader) {
      this.bitmapLoader.load(
        url,
        (bitmap) => {
          if (this.isStale(index, entry)) {
            bitmap.close();
            return;
          }
          this.decoded(entry, new THREE.Texture(bitmap));
        },
        undefined,
        onError,
      );
      return;
    }

    this.imageLoader.load(
      url,
      (texture) => {
        if (this.isStale(index, entry)) {
          texture.dispose();
          return;
        }
        this.decoded(entry, texture);
      },
      undefined,
      onError,
    );
  }

  /** Çözülmüş dokulardan birini GPU'ya yükler; öndeki fotoğrafa en yakın olan önce gelir. */
  uploadNext(renderer: THREE.WebGLRenderer, activeIndex: number) {
    let nearest: Entry | null = null;
    let nearestDistance = Infinity;
    for (const [index, entry] of this.entries) {
      if (entry.status !== 'decoded') continue;
      const distance = this.distance(index, activeIndex);
      if (distance < nearestDistance) {
        nearest = entry;
        nearestDistance = distance;
      }
    }
    if (!nearest?.texture) return;
    renderer.initTexture(nearest.texture);
    nearest.status = 'ready';
  }

  /** Sınır aşıldıysa öndeki fotoğrafa (dairesel) en uzak dokuları siler. */
  evict(activeIndex: number) {
    if (this.entries.size <= MAX_TEXTURES) return;
    const farthest = [...this.entries.keys()].sort(
      (a, b) => this.distance(b, activeIndex) - this.distance(a, activeIndex),
    );
    for (const index of farthest.slice(0, this.entries.size - MAX_TEXTURES)) {
      const entry = this.entries.get(index);
      if (entry?.texture) release(entry.texture);
      this.entries.delete(index);
    }
  }

  dispose() {
    this.disposed = true;
    this.entries.forEach((entry) => {
      if (entry.texture) release(entry.texture);
    });
    this.entries.clear();
  }

  private decoded(entry: Entry, texture: THREE.Texture) {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = this.anisotropy;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.generateMipmaps = true;
    texture.needsUpdate = true;
    entry.texture = texture;
    entry.status = 'decoded';
  }

  /** Yüklenirken bellekten atıldıysa doku kullanılmaz. */
  private isStale(index: number, entry: Entry): boolean {
    return this.disposed || this.entries.get(index) !== entry;
  }

  private distance(index: number, activeIndex: number): number {
    const count = this.images.length;
    const diff = wrapIndex(index - activeIndex, count);
    return Math.min(diff, count - diff);
  }
}

/** Dokuyu GPU'dan, ImageBitmap ise çözülmüş görüntüyü de bellekten siler. */
function release(texture: THREE.Texture) {
  texture.dispose();
  const image: unknown = texture.image;
  if (typeof ImageBitmap !== 'undefined' && image instanceof ImageBitmap) image.close();
}
