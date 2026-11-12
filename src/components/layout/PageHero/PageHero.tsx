import { type ReactNode, type Ref, useLayoutEffect, useRef } from 'react';
import { gsap, MOTION, SplitText, useGSAP } from '../../../animations/gsap';
import { getPageIntroDelay } from '../../../animations/pageIntro';
import { usePrefersReducedMotion } from '../../../hooks/useDevice';
import styles from './PageHero.module.css';

// Ölçüm farkları başlığı header'a değdirmesin diye küçük bir pay bırakılır.
const TITLE_FIT_MARGIN = 1.03;

type PageHeroProps = {
  title: string;
  /** Başlığın sağında kalan alanın kaç kolona bölüneceği. */
  columns?: 1 | 2;
  className?: string;
  ref?: Ref<HTMLElement>;
  children?: ReactNode;
};

/** Başlığın `em` cinsinden ölçüleri. CSS bunlarla her sayfa adını aynı yüksekliğe sığdırır. */
function measureTitle(element: HTMLElement, text: string) {
  const context = document.createElement('canvas').getContext('2d');
  if (!context) return null;

  const { fontWeight, fontFamily } = getComputedStyle(element);
  context.font = `${fontWeight} 100px ${fontFamily}`;
  // SplitText harfleri ayırdığı için ekrandaki metinde kerning yoktur.
  context.fontKerning = 'none';

  const { width, actualBoundingBoxLeft, actualBoundingBoxRight } = context.measureText(text);
  const startBearing = -actualBoundingBoxLeft;
  const endBearing = width - actualBoundingBoxRight;

  return {
    em: width / 100,
    inkEm: (actualBoundingBoxLeft + actualBoundingBoxRight) / 100,
    // Başlık aşağıdan yukarı okunduğu için bitiş boşluğu üstte, başlangıç boşluğu alttadır.
    inkOffsetEm: (endBearing - startBearing) / 200,
  };
}

/** Ana sayfa dışındaki sayfaların girişi: solda yan yatmış sayfa adı, sağında sayfanın içeriği. */
export function PageHero({ title, columns = 1, className = '', ref, children }: PageHeroProps) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const innerRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const columnClass = columns === 2 ? styles.twoColumns : styles.oneColumn;

  useLayoutEffect(() => {
    const inner = innerRef.current;
    const heading = titleRef.current;
    if (!inner || !heading) return;

    let isCancelled = false;
    const applyFit = () => {
      const measured = measureTitle(heading, title);
      if (!measured || isCancelled) return;

      inner.style.setProperty('--title-em', String(measured.em * TITLE_FIT_MARGIN));
      inner.style.setProperty('--title-ink-em', String(measured.inkEm));
      inner.style.setProperty('--title-ink-offset-em', String(measured.inkOffsetEm));
    };

    applyFit();
    // Doğrudan açılışta font sonradan iner, ölçüm gerçek fontla yenilenir.
    const { fontWeight, fontFamily } = getComputedStyle(heading);
    document.fonts.load(`${fontWeight} 1em ${fontFamily}`, title).then(applyFit, () => undefined);

    return () => {
      isCancelled = true;
    };
  }, [title]);

  // Başlık değişince (dil dahil) yeniden bölünür.
  useGSAP(
    () => {
      if (prefersReducedMotion || !titleRef.current) return;

      const delay = getPageIntroDelay();
      SplitText.create(titleRef.current, {
        type: 'chars',
        mask: 'chars',
        autoSplit: true,
        // Başlık yan yattığı için harfler kendi maskelerinden yatay eksende çıkar.
        onSplit: (self) =>
          gsap.from(self.chars, {
            xPercent: -110,
            duration: MOTION.slow,
            ease: MOTION.ease,
            stagger: MOTION.stagger,
            delay,
          }),
      });
    },
    { scope: gridRef, dependencies: [title, prefersReducedMotion], revertOnUpdate: true },
  );

  useGSAP(
    () => {
      if (prefersReducedMotion || !gridRef.current) return;

      gsap.from(gridRef.current.children, {
        scaleY: 0,
        transformOrigin: '50% 0%',
        duration: MOTION.slow,
        ease: MOTION.ease,
        stagger: MOTION.stagger,
        delay: getPageIntroDelay(),
      });
    },
    { scope: gridRef, dependencies: [prefersReducedMotion], revertOnUpdate: true },
  );

  return (
    <section ref={ref} className={`${styles.hero} ${className}`} data-surface="dark">
      <div ref={innerRef} className={`${styles.inner} ${columnClass}`} data-page-hero-inner>
        <div ref={gridRef} className={`${styles.grid} ${columnClass}`} aria-hidden="true">
          {Array.from({ length: columns + 1 }, (_, index) => (
            <span key={index} className={styles.gridLine} />
          ))}
        </div>

        {/* SplitText DOM'u değiştirdiği için başlık değişince React temiz bir eleman kurar. */}
        <h1 key={title} ref={titleRef} className={styles.title}>
          {title}
        </h1>

        {children}
      </div>
    </section>
  );
}
