import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { type BlockerFunction, NavigationType, useBlocker } from 'react-router';
import { gsap, MOTION, useGSAP } from '../../../animations/gsap';
import { NAV_ITEMS } from '../../../content/navigation';
import { REDUCED_MOTION_QUERY } from '../../../hooks/useDevice';
import { getLocaleFromPathname, stripLocale } from '../../../i18n/locale';
import styles from './PageTransition.module.css';

type Phase = 'idle' | 'entering' | 'covered' | 'leaving';

// Fontun hem latin hem latin-ext dosyası önceden insin, ilk geçişte yazı atlamasın.
const FONT_PRELOAD_GLYPHS = 'Aİ';

// Dil değişiminde ve yönlendirmelerde (replace) perde çalışmaz.
const isPageChange: BlockerFunction = ({ currentLocation, nextLocation, historyAction }) =>
  historyAction !== NavigationType.Replace &&
  stripLocale(currentLocation.pathname) !== stripLocale(nextLocation.pathname);

/**
 * Sayfa değişimini perde ekranı kaplayana kadar bekletir, yeni sayfa perdenin arkasında açılır.
 * Linkler ve tarayıcının geri/ileri tuşları aynı yoldan geçer.
 */
export function PageTransition() {
  const { i18n } = useTranslation();
  const blocker = useBlocker(isPageChange);
  const blockerRef = useRef(blocker);
  const syncRef = useRef<(() => void) | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const labelRef = useRef<HTMLSpanElement>(null);
  const [targetPathname, setTargetPathname] = useState('/');

  // Perde kalkarken blocker boşa düşer, hedef sayfa bilgisi burada saklanır.
  if (blocker.state === 'blocked' && blocker.location.pathname !== targetPathname) {
    setTargetPathname(blocker.location.pathname);
  }

  useGSAP(
    (_context, contextSafe) => {
      const root = rootRef.current;
      const label = labelRef.current;
      if (!root || !label || !contextSafe) return;

      let phase: Phase = 'idle';
      const isReduced = () => window.matchMedia(REDUCED_MOTION_QUERY).matches;

      const handleCovered = () => {
        phase = 'covered';
        sync();
      };

      const handleLeft = () => {
        gsap.set(root, { autoAlpha: 0 });
        delete document.documentElement.dataset.pageCurtain;
        phase = 'idle';
        sync();
      };

      const enter = () => {
        phase = 'entering';
        // Yeni sayfa giriş animasyonunu perde kalkana kadar bununla geciktirir.
        document.documentElement.dataset.pageCurtain = 'true';

        if (isReduced()) {
          gsap.set([root, label], { yPercent: 0 });
          gsap.to(root, { autoAlpha: 1, duration: MOTION.fast, ease: 'none', onComplete: handleCovered });
          return;
        }

        gsap
          .timeline({ defaults: { ease: MOTION.ease, duration: MOTION.curtain }, onComplete: handleCovered })
          .set(root, { autoAlpha: 1 })
          .fromTo(root, { yPercent: 100 }, { yPercent: 0 }, 0)
          .fromTo(label, { yPercent: 110 }, { yPercent: 0 }, MOTION.curtainLabelDelay);
      };

      const leave = () => {
        phase = 'leaving';

        if (isReduced()) {
          gsap.to(root, {
            autoAlpha: 0,
            duration: MOTION.fast,
            delay: MOTION.curtainHold,
            ease: 'none',
            onComplete: handleLeft,
          });
          return;
        }

        gsap.to(root, {
          yPercent: -100,
          duration: MOTION.curtain,
          delay: MOTION.curtainHold,
          ease: MOTION.ease,
          onComplete: handleLeft,
        });
      };

      // Animasyon sürerken gelen yeni bir gezinmede en son hedefe gidilir.
      const sync = contextSafe(() => {
        const current = blockerRef.current;

        if (phase === 'idle' && current.state === 'blocked') enter();
        else if (phase === 'covered' && current.state === 'blocked') current.proceed();
        else if (phase === 'covered' && current.state === 'unblocked') leave();
      });

      syncRef.current = sync;
      return () => {
        syncRef.current = null;
      };
    },
    { scope: rootRef },
  );

  useEffect(() => {
    blockerRef.current = blocker;
    syncRef.current?.();
  }, [blocker]);

  useEffect(() => {
    if (!labelRef.current) return;
    const { fontWeight, fontFamily } = getComputedStyle(labelRef.current);
    document.fonts.load(`${fontWeight} 1em ${fontFamily}`, FONT_PRELOAD_GLYPHS).catch(() => undefined);
  }, []);

  const locale = getLocaleFromPathname(targetPathname);
  const targetRoute = stripLocale(targetPathname);
  const targetItem = NAV_ITEMS.find(({ path }) => path === targetRoute);
  // Ana sayfaya dönüşte perde yazısız gelir.
  const label =
    targetItem && targetItem.key !== 'home'
      ? i18n.getFixedT(locale)(`nav.items.${targetItem.key}`).toLocaleUpperCase(locale)
      : '';

  return (
    <div ref={rootRef} className={styles.curtain} aria-hidden="true">
      <div className={styles.content}>
        <div className={styles.mask}>
          <span ref={labelRef} className={styles.label}>
            {label}
          </span>
        </div>
      </div>
    </div>
  );
}
