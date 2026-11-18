import { useLayoutEffect, useRef } from 'react';
import { gsap, MOTION, SplitText, useGSAP } from '../../../animations/gsap';
import { getPageIntroDelay } from '../../../animations/pageIntro';
import { usePrefersReducedMotion } from '../../../hooks/useDevice';
import styles from './PageHero.module.css';

// Ölçüm farkları başlığı kenara taşırmasın diye küçük bir pay bırakılır.
const TITLE_FIT_MARGIN = 1.03;

type PageHeroProps = {
  title: string;
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
export function PageHero({ title }: PageHeroProps) {
  const prefersReducedMotion = usePrefersReducedMotion();
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
            duration: MOTION.slow,
            ease: MOTION.ease,
            stagger: MOTION.stagger,
            delay,
          }),
      });
    },
    { scope: rootRef, dependencies: [title, prefersReducedMotion], revertOnUpdate: true },
  );

  return (
    <section ref={rootRef} className={styles.hero} data-surface="light" data-tone="white">
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
