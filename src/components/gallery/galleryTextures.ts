import * as THREE from 'three';
import { wrapIndex } from './carouselController';
import type { GalleryImage } from './galleryApi';

interface Entry {
  texture: THREE.Texture | null;
  status: 'loading' | 'ready' | 'error';
}

// Bellekte tutulan en fazla doku. Fazlası, öndeki fotoğrafa en uzak olandan başlayarak silinir.
const MAX_TEXTURES = 64;

/** Fotoğraf dokularını ihtiyaç oldukça yükler, uzaklaşanları bellekten atar. */
export class GalleryTextures {
  private readonly entries = new Map<number, Entry>();
  private readonly loader = new THREE.TextureLoader().setCrossOrigin('anonymous');
  private disposed = false;
  private readonly images: readonly GalleryImage[];
  private readonly anisotropy: number;

  constructor(images: readonly GalleryImage[], anisotropy: number) {
    this.images = images;
    this.anisotropy = anisotropy;
  }

  get(index: number): THREE.Texture | null {
    return this.entries.get(index)?.texture ?? null;
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
    this.loader.load(
      this.images[index].url,
      (texture) => {
        // Yüklenirken bellekten atıldıysa doku kullanılmaz.
        if (this.disposed || this.entries.get(index) !== entry) {
          texture.dispose();
          return;
        }
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.anisotropy = this.anisotropy;
        texture.minFilter = THREE.LinearMipmapLinearFilter;
        texture.generateMipmaps = true;
        entry.texture = texture;
        entry.status = 'ready';
      },
      undefined,
      () => {
        entry.status = 'error';
      },
    );
  }

  /** Sınır aşıldıysa öndeki fotoğrafa (dairesel) en uzak dokuları siler. */
  evict(activeIndex: number) {
    if (this.entries.size <= MAX_TEXTURES) return;
    const count = this.images.length;
    const distance = (index: number) => {
      const diff = wrapIndex(index - activeIndex, count);
      return Math.min(diff, count - diff);
    };
    const farthest = [...this.entries.keys()].sort((a, b) => distance(b) - distance(a));
    for (const index of farthest.slice(0, this.entries.size - MAX_TEXTURES)) {
      this.entries.get(index)?.texture?.dispose();
      this.entries.delete(index);
    }
  }

  dispose() {
    this.disposed = true;
    this.entries.forEach((entry) => entry.texture?.dispose());
    this.entries.clear();
  }
}
