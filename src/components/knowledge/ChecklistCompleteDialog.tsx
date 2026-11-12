import { type KeyboardEvent as ReactKeyboardEvent, useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { Link, useLocation } from 'react-router';
import { gsap, MOTION, useGSAP } from '../../animations/gsap';
import { usePrefersReducedMotion } from '../../hooks/useDevice';
import { useScrollLock } from '../../hooks/useSmoothScroll';
import { getLocaleFromPathname, localizePath } from '../../i18n/locale';
import { RollArrow, RollText } from '../ui/RollText/RollText';
import styles from './ChecklistCompleteDialog.module.css';

const CLOSE_TIME_SCALE = 1.5;

type ChecklistCompleteDialogProps = {
  total: number;
  onClose: () => void;
};

/**
 * Seçim listesinin tamamı işaretlenince açılır. Bir ürün önermez, uzman görüşü için iletişime yönlendirir.
 * Lightbox gibi `body` altına kurulur ve aynı perde hareketini kullanır.
 */
export function ChecklistCompleteDialog({ total, onClose }: ChecklistCompleteDialogProps) {
  const { t, i18n } = useTranslation('knowledge');
  const { pathname } = useLocation();
  const prefersReducedMotion = usePrefersReducedMotion();
  const rootRef = useRef<HTMLDivElement>(null);
  const curtainRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const ctaRef = useRef<HTMLAnchorElement>(null);
  const timelineRef = useRef<gsap.core.Timeline | null>(null);
  const contactPath = localizePath('/contact', getLocaleFromPathname(pathname));

  useScrollLock(true);

  useGSAP(
    () => {
      if (prefersReducedMotion || !curtainRef.current || !panelRef.current) return;

      timelineRef.current = gsap
        .timeline({ defaults: { ease: MOTION.ease, duration: MOTION.base } })
        .from(curtainRef.current, { scaleY: 0 }, 0)
        // Odaklanan öğeler gizlenemeyeceği için yalnızca opaklık ve konum değişir.
        .from(panelRef.current, { y: 48, opacity: 0 }, MOTION.stagger * 2);
    },
    { scope: rootRef },
  );

  const close = useCallback(() => {
    const timeline = timelineRef.current;
    if (!timeline || timeline.progress() === 0) {
      onClose();
      return;
    }

    timeline.eventCallback('onReverseComplete', onClose).timeScale(CLOSE_TIME_SCALE).reverse();
  }, [onClose]);

  // Odak iletişim düğmesine gider, kapanınca son işaretlenen kutuya döner.
  useEffect(() => {
    const previouslyFocused = document.activeElement;
    ctaRef.current?.focus({ preventScroll: true });

    return () => {
      if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus({ preventScroll: true });
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [close]);

  // Tab odak döngüsü pencerenin içinde kalır.
  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Tab' || !panelRef.current) return;

    const focusables = panelRef.current.querySelectorAll<HTMLElement>('a[href], button');
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (!first || !last) return;

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return createPortal(
    <div
      ref={rootRef}
      className={styles.root}
      role="dialog"
      aria-modal="true"
      aria-labelledby="checklist-complete-title"
      aria-describedby="checklist-complete-text"
      onKeyDown={handleKeyDown}
    >
      {/* Zemine tıklamak pencereyi kapatır. Klavyede aynı iş Escape ve "Listeye dön" ile yapılır. */}
      <div ref={curtainRef} className={styles.curtain} onClick={close} aria-hidden="true" />

      <div ref={panelRef} className={styles.panel} data-lenis-prevent>
        <h2 id="checklist-complete-title" className={styles.title}>
          {t('checklist.complete.title', { total })}
        </h2>
        <p id="checklist-complete-text" className={styles.text}>
          {t('checklist.complete.text')}
        </p>

        <div className={styles.actions}>
          <Link ref={ctaRef} className={styles.cta} to={contactPath}>
            <RollText text={t('checklist.complete.cta').toLocaleUpperCase(i18n.language)} />
            <RollArrow />
          </Link>
          <button className={styles.back} type="button" onClick={close}>
            {t('checklist.complete.back')}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
