# [FİRMA ADI]: Proje Günlüğü

## Durum

Şablondan yeni başlandı. Header, layout, sayfa geçişi, sayfa başlıklı hero, bölüm rayı, çok dil altyapısı, özel imleç ve scrollbar hazır. Bilgi merkezi sayfası örnek içerikle hazır, diğer sayfaların içerikleri yok.

## Yeni Projeye Başlarken

- [ ] `CLAUDE.md` ve bu dosyadaki köşeli parantezli alanları doldur.
- [ ] `package.json` içindeki `name` alanını ve `index.html` başlığını değiştir.
- [ ] `pnpm install` çalıştır (workspace kökünden).
- [ ] `public/` altındaki `logo-for-dark-surface.svg`, `logo-for-light-surface.svg` ve `favicon.svg` dosyalarını firma logolarıyla değiştir. Logo oranı farklıysa `Header.tsx` içindeki `width` ve `height` değerlerini, `tokens.css` içindeki `--logo-height` değerini güncelle.
- [ ] `src/styles/tokens.css` içindeki renkleri kurumsal kimliğe göre güncelle.
- [ ] Sayfa geçişi perdesini kontrol et: rengi `--color-accent`, yazısı siyah. Vurgu rengi koyuysa `PageTransition.module.css` içindeki yazı rengini açık yap. Yazı fontu `--font-transition`, sektöre uymuyorsa değiştir ve Türkçe harfleri kontrol et.
- [ ] `src/locales/{tr,en}/common.json` içindeki site başlığını ve menü metinlerini güncelle.
- [ ] Menü ve yolları `src/content/navigation.ts` içinden düzenle, çeviri anahtarlarını da eşle.
- [ ] Vurgu rengi koyuysa `tokens.css` içindeki `--rail-solid-color` değerini beyaz yap.
- [ ] `src/pages/DemoPage.tsx` ve `src/pages/SectionPage.tsx` geçici sayfalarını gerçek sayfalarla değiştir (`PageHero` kalır), `src/router.tsx` içindeki yolları güncelle.

## Yapılanlar

### Ana sayfa: tam ekran 3D şehir hero'su (v2, beyaz maket)

- `src/pages/HomePage.tsx` (`data-surface="dark"`, `min-block-size: 100svh`) `CityHero` bileşenini tam ekran gösterir. Ekran okuyucular için görünmez `h1` olarak `meta.title` kullanılır. Eski `DemoPage` ana sayfadan çıkarıldı, dosyası duruyor.
- `src/components/home/CityHero/`: `CityHero.tsx` (poster yok, sahne hemen yüklenir ve ilk kareler hazır olunca koyu zeminden solarak gelir; ekran dışında ve sekme gizliyken çizimi durdurma), `CityCanvas.tsx` (React Three Fiber sahnesi, `React.lazy` ile ayrı parça, çizimi R3F doğrudan yapar), `cityRuntime.ts` (atmosfer, cephe, arazi, mat zemin ve su shader'ları, zemin katmanlama, teleferik, kamera). `smartcity-hero-package` v2'den TypeScript'e taşındı.
- Önceki şehir (v1) tamamen kaldırıldı: eski GLB, posterler, KTX2 transcoder (`public/basis/`), config ve çalışma zamanı. v2'de doku yoktur, KTX2 yükleyicisi kullanılmaz.
- Varlıklar: `public/models/smart_city.glb`. Kamera ve teleferik verisi `src/content/city-config.json`. Poster kullanılmıyor, `public/img/city-hero*.webp` dosyaları artık hiçbir yerde kullanılmıyor (silinebilir).
- Bağımlılıklar: `three@0.170.0`, `@react-three/fiber@9`, `@types/three`.
- Kalite `useIsMobile` ile belirlenir (mobil: medium, düşük bellekte low). Düşük kalitede gölge ve antialias kapalıdır. `prefers-reduced-motion` açıkken kamera süzülmesi, fare parallax'ı ve teleferik durur.
- Paketteki tesis kamerası uçuşları, zaman kaydırıcısı ve butonlar alınmadı, yalnızca hero görünümü var (zaman değeri `CityCanvas.tsx` içinde sabit 0.4).
- Hero kamerası şehre kuzeybatıdan, paketteki açının tam karşısından bakar (`HERO_AZIMUTH_OFFSET`, `cityRuntime.ts`). Mesafesi paketteki değerin %80'i (`HERO_DISTANCE_SCALE`). Yakın düzlem, gölge alanı ve sis mesafeye göre kendiliğinden ayarlanır.
- `public/models/smart_city.glb` düzenlendi: hastane kanatlarındaki kırmızı haç işaretleri (`Hospital_Helipad` mesh'inde kırmızı vertex rengli 8 üçgen) çıkarıldı, helipad "H" işareti kalıyor. Paketin kaynak üretim hattı (`build/buildCity.mjs`, "red cross markers") yeniden çalıştırılırsa haçlar geri gelir. Orijinal dosya `smartcity-hero-package/public/models/` altında duruyor.
- Tilt-shift ve post-process kodu kaldırıldı.
- **Görsel iyileştirme (yapay görünümü giderme):** Sahne tek bir altın saat ışığına alındı (`TIME_OF_DAY = 0`). Önceki 0.4 değeri gün ışığını parlayan cephelerle karıştırıyordu. Ton eşleme ACES yerine Neutral. Cephelerde bina başına malzeme tonu, cam oranı, koyu ve parlak camlar ve zemine yakın temas gölgesi var, uzaktan bakınca duvarlar artık ışık kutusu gibi parlamıyor. Arazide toprak lekeleri ve çalı benekleri var, kontur çizgileri hafifletildi (`uContour` 0.3), ağaçlar örnek başına farklı ton alıyor. `Mat_Matte` yüzeylerine hafif yıpranma eklendi. Su mavi (`#2f6f96`), dalga normali yalnızca birkaç piksele yayıldığında çizilir. Sis, aerial perspective etkisi verecek kadar yoğunlaştırıldı. Yeni bağımlılık eklenmedi.
- **Performans ve titreme düzeltmeleri (tarayıcıda ölçüldü):**
  - Post-process (4x MSAA'lı half-float hedef + bloom + renk düzeltme) tamamen kaldırıldı, tilt-shift kodu da gitti. Kare süresinin asıl yükü buydu. Çizim artık doğrudan tuvale, tarayıcının antialias'ıyla yapılıyor. Vinyet CSS ile veriliyor (`CityHero.module.css`, `.root::after`).
  - Gölge haritası her karede değil, yalnızca odak değişince çiziliyor (`shadowMap.autoUpdate = false`). Gondollar gölge düşürmüyor.
  - dpr üst sınırı her kalitede 1.25 (Retina'da 1.75 piksel sayısını 2.6 katına çıkarıyordu).
  - GTAO denendi, kaldırıldı (kasma ve gürültü).
  - Ölçüm (Retina, 1680×843): fare hareketi sırasında kare süresi medyan 16.7 ms, p95 17.6 ms, 30 ms'yi aşan kare yok.
  - Titremenin kaynağı Business_Ground ve Residential_Ground içinde aynı yükseklikte üst üste çizilmiş döşeme, asfalt, toprak ve çim yamalarıydı (z-fighting). `layerGround`, birden çok renkli bütün düz mesh'lerde (yollar hariç) yamaları önce renk sınıfına, sonra büyüklüğüne göre en fazla 4.2 cm kaldırıyor. Bu kapsam pist ile deniz arasındaki çim şeritlerini (`Airport_Airfield`) ve dairesel tarlaları (`Agriculture_Fields`) da içeriyor. Model üzerinde çakışma taraması yapıldı. 5 mm altında kalanlar silo/kule tepeleri, görünmeyen silo tabanları ve pist kaplamasıyla sınırlı. Kamera yakın düzlemi `dist * 0.35` (derinlik hassasiyeti ~4 kat arttı). Gündüz trafik ışığı noktaları gizli, pencere ızgarası ancak ~5 piksele yayılınca çiziliyor.
  - Su sarı değildi: `uTime` uniform'u tanımlanmadığı için su shader'ı derlenmiyor, arkadaki sis rengi görünüyordu.
  - Mobil ve tablette ayrıca test edilmedi.
- `.oxlintrc.json`: `dist/**` lint dışı.
- Tip kontrolü, lint ve build temiz geçti. v2 için tarayıcıda görsel kontrol ve cihaz testi henüz yapılmadı.

### Şablon: Bilgi merkezi sayfası (Adanex projesinden genelleştirildi)

- `/knowledge-center` hazır bir başvuru sayfası olarak geliyor (`src/pages/KnowledgePage.tsx`, `src/components/knowledge/`), rota lazy yükleniyor. İçerik örnektir, her maddenin hangi düzen özelliğini gösterdiğini anlatır. Gerçek içerik yoksa `[YER TUTUCU]` yazar.
- **Hero:** `PageHero` içinde büyük arama satırı ve bölüm dizini. Yazmaya başlayınca bölüm satırlarının yerini sonuçlar alır, arama büyük harf ve aksan farkını yok sayar. Altta "Kaydır" belirteci (`src/components/ui/ScrollCue/`).
- **Bölümler:** 1024 px ve üstünde solda yapışık bölüm başlığı ve okunan maddeyi gösteren madde dizini, sağda akan maddeler. Daha dar ekranda tek sütun, dizin yerine sağdaki ray (`SectionRail`, mobilde alt şerit) kullanılır.
- **Madde yapıları:** öne çıkan tanım, kısa yanıt etiketi, paragraflar, numaralı/akış/numarasız liste, adımlar, fosforlu kalem vurgusu, dar ekranda karta dönen tablo, "Bkz." bağlantıları ve metin içi dış bağlantılar (`EXTERNAL_LINKS`). Her maddenin paylaşılabilir adresi var (`#comparison` gibi), atlanınca vurgu renkli bir çizgi yanıp söner.
- **Görseller:** dört boyut tipi (`mark`, `wide`, `poster`, `document`), tıklanınca tam ekran açılır (`src/components/ui/Lightbox/`). `imageInAside: true` verilen maddenin görseli geniş ekranda madde dizininin altına geçer ve yalnızca o madde okunurken görünür.
- **Kontrol listesi bölümü:** vurgu renkli zeminde `GenericCheckbox` ile işaretlenen liste, sol sütunda sayaç. Hepsi işaretlenince iletişim sayfasına yönlendiren pencere açılır (`ChecklistCompleteDialog`, telefonda altta, geniş ekranda ortada).
- **Ortak eklemeler:** `--font-display` ve `--weight-display` (şimdilik Geist), `--text-kb-*` boyutları, `--z-lightbox`, `--selection-bg` desteği (`base.css`), `RollText`/`RollArrow` (`src/components/ui/RollText/`), "Kaydır" hareket sabitleri (`MOTION`). Özel imleç `data-tone="accent"` taşıyan bölümlerde tıklanabilir alanda `--rail-solid-color` ile çizilir.
- **Yeni projede:** bölüm ve maddeleri `src/content/knowledge.ts` içinden, metinleri `src/locales/{tr,en}/knowledge.json` içinden düzenle, örnek görselleri (`public/knowledge-*.svg`) gerçek görsellerle değiştir ve ölçülerini `KNOWLEDGE_IMAGES` içinde güncelle. Kullanılmayacaksa sayfa, rota ve `components/knowledge/` silinebilir.
- **Font:** Adanex'te büyük başlıklar Barlow Semi Condensed ile yazılıyor. Dar bir font istenirse paket eklenip `--font-display` değiştirilir, `--text-kb-chapter-side` gibi boyutlar büyütülebilir.
- Tip kontrolü, lint ve build temiz geçti. Tarayıcıda görsel kontrol yapılmadı.

## Sıradaki Teknik İşler

- Rota bazlı code splitting.
- Dil ve sayfa bazlı meta açıklamaları, `canonical` ve `hreflang`.

## Açık Kararlar

- [ ] Kurumsal renkler, logo, içerik ve görsel kaynakları
- [ ] SEO ve render: saf SPA mı, build sırasında prerender mı? (Öneri: `vite-react-ssg` veya eşdeğeri ile prerender)
- [ ] İçerik yönetimi: çeviri dosyaları ve tipli veriyle devam mı, headless CMS mi?
- [ ] İletişim formunun gönderileceği servis
- [ ] Yayın ortamı
