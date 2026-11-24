/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Galeri listesini veren API (Cloudflare). Tanımlı değilse geliştirmede örnek görseller kullanılır. */
  readonly VITE_GALLERY_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
