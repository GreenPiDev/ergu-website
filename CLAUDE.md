# [FİRMA ADI] Web Sitesi

[SEKTÖR] alanında faaliyet gösteren bir firmanın kurumsal web sitesi. Hedef, Awwwards seviyesinde premium bir deneyim.

- **Repo:** [REPO ADRESİ] (ana dal: `main`)
- **Durum, yapılanlar, açık kararlar ve planlar:** `PROGRESS.md`. Her tamamlanan işten sonra güncellenir. Oradaki açık kararlar için varsayım yapma, kullanıcıya sor.

> Bu dosya şablondur. Köşeli parantezli alanları doldur, yeni projeye başlarken `PROGRESS.md`'deki kurulum listesini uygula.

## Çalışma Şekli

- **Kullanıcıya sormadan tarayıcı testi yapılmaz.** Tarayıcı açma, otomasyon (Chrome eklentisi, Playwright vb.) ve ekran görüntüsü alma buna dahildir.
- **Kullanıcıya sormadan sunucu ayağa kaldırılmaz.** `npm run dev`, `npm run preview` ve benzeri tüm sunucular buna dahildir.
- Kullanıcı istemedikçe commit veya push yapma.
- İş bitmeden `npm run typecheck`, `npm run lint` ve `npm run build` çalıştır. `build`, çeviri anahtarı kontrolünü de içerir.
- API kullanmadan önce context7 ile güncel dokümana bak.
- Yeni bağımlılık eklemeden önce gerekçesini söyle, aynı işi yapan ikinci kütüphaneyi ekleme.
- Tasarım kararı gerektiğinde tek bir öneriyle gel, gerekçesini kısaca söyle.

## Teknoloji

React, Vite, TypeScript (`strict`), GSAP + `@gsap/react`, Lenis, React Router, i18next + react-i18next, CSS Modules + CSS değişkenleri, Geist Variable, sayfa geçişi yazısı için Big Shoulders Stencil. Formlar için `react-hook-form` + `zod`. 3D yalnızca gerçekten değer katan bir an için ve lazy load ile kullanılır.

## Kod Kuralları

- Dosya ve tanımlayıcılar İngilizce, kod yorumları Türkçe. `any` kullanılmaz.
- Header yalnızca `RootLayout` içinde durur, sayfalara eklenmez.
- Ana sayfa dışındaki her sayfa `PageHero` ile başlar: solda yan yatmış, şeffaf sayfa adı, sağında sayfanın içeriği. Hero scroll'da yukarıda kalır, yapışık değildir.
- `main` içindeki her tam genişlik bölüm `data-surface="dark"` veya `data-surface="light"` taşır, header rengi ve logosu buradan belirlenir.
- Renk, boşluk, font boyutu, süre ve easing token'dan gelir (`src/styles/tokens.css`).
- Büyük/küçük harf dönüşümünde aktif dil kullanılır: `toLocaleUpperCase(i18n.language)` (i/İ, ı/I sorunu).

## Çok Dil ve URL

- Site Türkçe ve İngilizcedir. **Koda gömülü statik metin yoktur.** `alt`, `aria-label`, placeholder, form hataları ve SEO metinleri dahil her metin `src/locales/{tr,en}/` dosyalarından gelir, iki dilin anahtarları birebir aynıdır.
- Dile bağlı olmayan veriler `src/content/` altında tek kaynakta tutulur.
- Cümle parçaları birleştirilmez, interpolation ve `Trans` kullanılır. Sayı ve tarih aktif dile göre biçimlenir.
- **Tüm URL'ler ve slug'lar her iki dilde de İngilizcedir, hiçbir Türkçe URL olmaz.** Türkçe içerik kökte (`/about`), İngilizce içerik `/en` altındadır (`/en/about`).
- Dilin tek doğruluk kaynağı URL'dir. `<html lang>`, `canonical` ve `hreflang` buna göre güncellenir.
- Dil değişince SplitText ve ilgili ScrollTrigger'lar yeniden kurulur, tasarım iki dilin metin uzunluğuna göre test edilir.
- Hukuki ve sektöre özel teknik çeviriler yayından önce firma onayından geçer.

## İçerik Doğruluğu

- Sertifika, teknik değer, müşteri adı, referans veya başarı rakamı **asla uydurulmaz**. Gerçek veri yoksa görünür biçimde `[YER TUTUCU]` yazılır ve yayından önce temizlenir.
- Mutlak ve doğrulanamayan reklam ifadeleri kullanılmaz.

## Tasarım ve Animasyon

- Premium his tipografi ve hareket kalitesinden gelir: büyük ölçekli başlıklar, tek güçlü vurgu rengi, bölüm bazlı açık/koyu zeminler.
- Örnek alınan sitelerin kodu, metinleri, görselleri ve renk paleti kopyalanmaz.
- Şablon hissi veren kart ızgaraları, gradient bloblar, stok ikonlar ve jenerik sektör görselleri kullanılmaz. Fontlar Türkçe karakterleri tam desteklemeli, ücretli fontlar lisanssız kullanılmaz.
- GSAP, React içinde `useGSAP` ve `scope` ile yazılır, ortak hareketler `src/animations/` altındadır.
- **Sayfa geçişi:** Vurgu renginde perde alttan yukarı hızla gelir, ortasında `--font-transition` fontuyla gidilen sayfanın adı yazar, sonra yukarı çıkıp gider. Ana sayfaya gidişte yazı olmaz, dil değişiminde perde çalışmaz. Tek kaynak `RootLayout` içindeki `PageTransition` bileşenidir, sayfalara ayrı geçiş yazılmaz.
- **Uzun sayfalarda bölüm rayı:** `SectionRail` (`src/components/ui/SectionRail/`) konumu, ilerlemeyi ve bölüme atlamayı sağlar. Bölümler tek kapsayıcının doğrudan alt öğeleridir, masaüstünde sağlarında `--rail-width` kadar yer bırakılır, vurgu rengi gibi doygun zeminli bölümler `data-rail-solid` taşır.
- Yalnızca `transform` ve `opacity` animasyonu yapılır. Her bölüme efekt yığılmaz.
- SplitText fontlar yüklendikten sonra çalışır. Her sayfa geçişinde ScrollTrigger'lar temizlenir ve yenilenir.
- `prefers-reduced-motion` desteklenir, hover efektleri yalnızca fare olan cihazlarda çalışır. Animasyon içeriğin okunmasını engellemez.

## Masaüstü, Tablet ve Mobil

Tüm cihazlar eşit önceliklidir, bir bölüm hepsinde sorunsuz çalışmadan bitmiş sayılmaz. Mobil, masaüstünün küçültülmüşü değildir.

- Cihaz algısının tek kaynağı `src/hooks/useDevice.ts`'dir: `useIsMobile`, `useIsTabletPortrait`, `useIsTabletLandscape`, `useIsNavCollapsed`, `useDevice`. Bileşenlerde ayrı `matchMedia` yazılmaz.
- Kontrol genişlikleri 360, 390, 768, 1024, 1440, 1920 px ile telefon ve tablet yatay konumudur. Yatay taşma, üst üste binen veya kesilen içerik olmaz.
- Tam ekran bölümlerde `svh`/`dvh` ve çentik için `safe-area-inset` kullanılır.
- Dokunma alanları en az 44×44 px'tir, hover ile açılan bilgi dokunarak da erişilebilir.
- Mobilde doğal scroll korunur. Pin'li sekanslar, parallax, WebGL ve büyük videolar hafifletilir.
- Teknik tablolar dar ekranda karta dönüşür. Form input yazı boyutu en az 16 px'tir.

## Kalite

- Mobilde Lighthouse 90+, LCP < 2.5 sn, CLS < 0.1, INP < 200 ms. Rota bazlı code splitting, AVIF/WebP görseller.
- Erişilebilirlik WCAG 2.2 AA. İletişim formunda KVKK metni ve açık onay bulunur.
