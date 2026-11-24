import { useLayoutEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router';
import { gsap, MOTION, SplitText, useGSAP } from '../../../animations/gsap';
import { getPageIntroDelay } from '../../../animations/pageIntro';
import { usePageRevealHold } from '../../../animations/pageReveal';
import { getPageHeroImage, type PageHeroImage } from '../../../content/pageHeroImages';
import { MOBILE_QUERY, usePrefersReducedMotion } from '../../../hooks/useDevice';
import { stripLocale } from '../../../i18n/locale';
import styles from './PageHero.module.css';

// Ölçüm farkları başlığı kenara taşırmasın diye küçük bir pay bırakılır.
const TITLE_FIT_MARGIN = 1.03;

// Görsel inene kadar sayfa geçişi perdesi bekler, yavaş bağlantıda en fazla bu kadar.
const IMAGE_HOLD_MS = 2500;

type PageHeroProps = {
  title: string;
  /** Görseli sayfanın yolundan bağımsız vermek için. Verilmezse `pageHeroImages.ts`'ten yola göre seçilir. */
  image?: PageHeroImage;
};

const CANVAS_STRETCH: Record<string, CanvasFontStretch> = {
  '62.5%': 'extra-condensed',
  '75%': 'condensed',
  '87.5%': 'semi-condensed',
  '100%': 'normal',
};

/** Başlığın `em` cinsinden ölçüleri. CSS bunlarla her sayfa adını bandın genişliğine sığdırır. */
function measureTitle(element: HTMLElement, text: string) {
  const context = document.createElement('canvas').getContext('2d');
  if (!context) return null;

  const { fontWeight, fontFamily, fontStretch } = getComputedStyle(element);
  // Canvas yalnızca anahtar kelime genişlikleri bilir; başlığın dar kesimi (75%) 'condensed' olarak ölçülür.
  const stretch = CANVAS_STRETCH[fontStretch] ?? 'normal';
  context.font = `${fontWeight} ${stretch} 100px ${fontFamily}`;
  context.fontStretch = stretch;
  // SplitText harfleri ayırdığı için ekrandaki metinde kerning yoktur.
  context.fontKerning = 'none';

  const { width, actualBoundingBoxLeft } = context.measureText(text);
  return {
    em: width / 100,
    // İlk harfin mürekkebi kenar boşluğuyla aynı hizaya çekilir.
    bearingEm: -actualBoundingBoxLeft / 100,
  };
}

/** Ana sayfa dışındaki sayfaların girişi: ekranın üçte biri yüksekliğinde bant, içinde büyük ve şeffaf sayfa adı. */
export function PageHero({ title, image }: PageHeroProps) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const { pathname } = useLocation();
  const { src, avif, mobileSrc, mobileAvif, focus } = image ?? getPageHeroImage(stripLocale(pathname));
  // Görsel inince (veya inemezse) perde kalkar. Yol değişip aynı bileşen kalırsa yeni görsel yeniden beklenir.
  const [settledSrc, setSettledSrc] = useState<string | null>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  usePageRevealHold(settledSrc === src, IMAGE_HOLD_MS);
  useLayoutEffect(() => {
    // Önbellekten gelen görsel bağlanmadan önce yüklenmiş olabilir.
    if (imageRef.current?.complete) setSettledSrc(src);
  }, [src]);
  const rootRef = useRef<HTMLElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const lineRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const root = rootRef.current;
    const heading = titleRef.current;
    if (!root || !heading) return;

    let isCancelled = false;
    const applyFit = () => {
      const measured = measureTitle(heading, title);
      if (!measured || isCancelled) return;

      root.style.setProperty('--title-em', String(measured.em * TITLE_FIT_MARGIN));
      root.style.setProperty('--title-bearing', String(measured.bearingEm));
    };

    applyFit();
    // Doğrudan açılışta font sonradan iner, ölçüm gerçek fontla yenilenir.
    const { fontWeight, fontFamily } = getComputedStyle(heading);
    document.fonts.load(`${fontWeight} 1em ${fontFamily}`, title).then(applyFit, () => undefined);

    return () => {
      isCancelled = true;
    };
  }, [title]);

  // Alt kenar çift çizgisi: kalın çizgi soldan çizilir, ince çizgi biraz geriden izler. Başlığın harfleriyle aynı anda
  // başlar.
  useGSAP(
    () => {
      const line = lineRef.current;
      if (prefersReducedMotion || !line) return;

      const part = (name: string) => line.querySelector(`[data-part="${name}"]`);
      gsap
        .timeline({ delay: getPageIntroDelay(), defaults: { ease: MOTION.ease, duration: MOTION.lineDraw } })
        .from(part('bold'), { scaleX: 0 }, 0)
        .from(part('fine'), { scaleX: 0 }, MOTION.stagger * 3);
    },
    { scope: rootRef, dependencies: [prefersReducedMotion] },
  );

  // Başlık değişince (dil dahil) yeniden bölünür. Harfler kendi maskelerinden aşağıdan yukarı çıkar.
  useGSAP(
    () => {
      if (prefersReducedMotion || !titleRef.current) return;

      const delay = getPageIntroDelay();
      SplitText.create(titleRef.current, {
        type: 'chars',
        mask: 'chars',
        autoSplit: true,
        onSplit: (self) =>
          gsap.from(self.chars, {
            yPercent: 110,
            duration: MOTION.heroTitle,
            ease: MOTION.ease,
            stagger: { amount: MOTION.heroTitleStaggerAmount },
            delay,
            // Bölünmüş DOM'da seçim vurgusu maskelerden taşar: animasyon bitince başlık düz metne döner.
            onComplete: () => {
              self.revert();
            },
          }),
      });
    },
    { scope: rootRef, dependencies: [title, prefersReducedMotion], revertOnUpdate: true },
  );

  return (
    <section ref={rootRef} className={styles.hero} data-surface="dark">
      {/* Dekoratif arka plan: sayfanın adı başlıkta yazar. Telefon kadrajı varsa dar ekranda o seçilir. */}
      <picture className={styles.media}>
        {mobileAvif && <source media={MOBILE_QUERY} srcSet={mobileAvif} type="image/avif" />}
        {mobileSrc && <source media={MOBILE_QUERY} srcSet={mobileSrc} type="image/webp" />}
        {avif && <source srcSet={avif} type="image/avif" />}
        <img
          key={src}
          ref={imageRef}
          className={styles.image}
          src={src}
          alt=""
          decoding="async"
          fetchPriority="high"
          style={focus ? { objectPosition: focus } : undefined}
          onLoad={() => setSettledSrc(src)}
          onError={() => setSettledSrc(src)}
        />
      </picture>
      <div className={styles.veil} aria-hidden="true" />
      {/* SplitText DOM'u değiştirdiği için başlık değişince React temiz bir eleman kurar. */}
      <h1 key={title} ref={titleRef} className={styles.title}>
        {title}
      </h1>
      <div ref={lineRef} className={styles.line} aria-hidden="true">
        <span className={styles.fine} data-part="fine" />
        <span className={styles.bold} data-part="bold" />
      </div>
    </section>
  );
}
