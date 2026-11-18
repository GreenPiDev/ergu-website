/**
 * Sayfa başlığı bandının (PageHero) arka plan görselleri. Her sayfa kendi görselini alabilir, atanmamış sayfalarda
 * varsayılan görsel görünür.
 *
 * Yeni görsel eklemek: dosyayı `public/img/page-hero/` altına koy (WebP zorunlu, AVIF önerilir, telefon için ayrı
 * kadraj isteğe bağlı), sonra `PAGE_HERO_IMAGES` içine sayfanın yolunu anahtar olarak yaz. Yol, `navigation.ts`'teki
 * dilden bağımsız yoldur (`/en` öneki yazılmaz), iki dil aynı görseli kullanır.
 *
 * Görseller dekoratiftir (alt=""): sayfanın adı zaten başlıkta yazar. Bant geniş ve alçak olduğu için görselin önemli
 * kısmı `focus` ile kadrajda tutulur.
 */

export type PageHeroImage = {
  /** Masaüstü ve tablet görseli, WebP. Önerilen boyut 2400×800 veya daha geniş. */
  src: string;
  /** Aynı kadrajın AVIF hali. Varsa tarayıcı önce bunu dener. */
  avif?: string;
  /** Telefon için ayrı kadraj, WebP. Yoksa telefonda da `src` kullanılır. */
  mobileSrc?: string;
  /** Telefon kadrajının AVIF hali. */
  mobileAvif?: string;
  /** Kadrajda tutulacak nokta (CSS object-position), ör. '50% 30%'. Varsayılan ortası. */
  focus?: string;
};

/** Görsel atanmamış her sayfada görünen görsel. */
export const DEFAULT_PAGE_HERO_IMAGE: PageHeroImage = {
  src: '/img/page-hero/projects.webp',
  mobileSrc: '/img/page-hero/projects-mobile.webp',
  // Tabela görselin biraz sağında, dar kadrajda kesilmesin diye odak oraya kaydırılır.
  focus: '60% center',
};

/** Sayfaya özel görseller. Anahtar, sayfanın yolu. */
export const PAGE_HERO_IMAGES: Readonly<Record<string, PageHeroImage>> = {
  // Örnek:
  // '/products/transformers': {
  //   src: '/img/page-hero/transformers.webp',
  //   avif: '/img/page-hero/transformers.avif',
  //   focus: '50% 40%',
  // },
};

/** Sayfanın görseli, yoksa varsayılan görsel. */
export function getPageHeroImage(path: string): PageHeroImage {
  return PAGE_HERO_IMAGES[path] ?? DEFAULT_PAGE_HERO_IMAGE;
}
