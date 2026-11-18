import { type CSSProperties, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { type BlockerFunction, NavigationType, useBlocker } from 'react-router';
import { gsap, MOTION, useGSAP } from '../../../animations/gsap';
import { whenPageRevealReady } from '../../../animations/pageReveal';
import { HOME_PATH, NAV_PAGES } from '../../../content/navigation';
import { REDUCED_MOTION_QUERY } from '../../../hooks/useDevice';
import { getLocaleFromPathname, stripLocale } from '../../../i18n/locale';
import styles from './PageTransition.module.css';

type Phase = 'idle' | 'entering' | 'covered' | 'waiting' | 'leaving';

// Fontun hem latin hem latin-ext dosyası önceden insin, ilk geçişte yazı atlamasın.
const FONT_PRELOAD_GLYPHS = 'Aİ';

// Bu uzunluğun üstündeki sayfa adları perdede küçük yazılır.
const LONG_LABEL_LENGTH = 16;

// Ana sayfaya gidişte perdenin ortasında yazı yerine firma ikonu durur.
const HOME_ICON_SRC = '/ergu-icon.png';

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
      let cancelWait: (() => void) | null = null;
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
        else if (phase === 'covered' && current.state === 'unblocked') {
          // Yeni sayfa hazır olana kadar (ör. 3D şehir) perde ekranda kalır.
          phase = 'waiting';
          cancelWait = whenPageRevealReady(
            contextSafe(() => {
              cancelWait = null;
              leave();
            }),
          );
        } else if (phase === 'waiting' && current.state === 'blocked') {
          // Beklerken başka sayfaya gidilirse perde zaten kapalı, doğrudan oraya geçilir.
          cancelWait?.();
          cancelWait = null;
          phase = 'covered';
          current.proceed();
        }
      });

      syncRef.current = sync;
      return () => {
        cancelWait?.();
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
    // İkon maske olarak kullanıldığı için ilk geçişte boş kalmasın diye önceden indirilir.
    new Image().src = HOME_ICON_SRC;
  }, []);

  const locale = getLocaleFromPathname(targetPathname);
  const targetRoute = stripLocale(targetPathname);
  const targetItem = NAV_PAGES.find(({ path }) => path === targetRoute);
  // Ana sayfaya dönüşte perdede yazı yerine firma ikonu görünür.
  const isHome = targetRoute === HOME_PATH;
  const label = targetItem && !isHome ? i18n.getFixedT(locale)(targetItem.labelKey).toLocaleUpperCase(locale) : '';
  // Uzun sayfa adları (ör. ürün adları) küçük boyutla birkaç satıra bölünür, ekrana sığar.
  const isLongLabel = label.length > LONG_LABEL_LENGTH;

  return (
    <div ref={rootRef} className={styles.curtain} aria-hidden="true">
      <div className={styles.content}>
        <div className={styles.mask}>
          <span ref={labelRef} className={styles.label} data-long={isLongLabel}>
            {isHome ? (
              <span className={styles.emblem}>
                {/* İkonun çevresinde ters yönlerde dönen iki yay. */}
                <svg className={styles.rings} viewBox="0 0 100 100">
                  <circle className={`${styles.ring} ${styles.ringOuter}`} cx="50" cy="50" r="47" pathLength="100" />
                  <circle className={`${styles.ring} ${styles.ringInner}`} cx="50" cy="50" r="40" pathLength="100" />
                </svg>
                <span
                  className={styles.icon}
                  style={{ '--icon-src': `url(${HOME_ICON_SRC})` } as CSSProperties}
                />
              </span>
            ) : (
              label
            )}
          </span>
        </div>
      </div>
    </div>
  );
}
