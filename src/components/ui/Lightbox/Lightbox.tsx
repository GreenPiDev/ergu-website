import { type MouseEvent, useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { gsap, MOTION, useGSAP } from '../../../animations/gsap';
import { usePrefersReducedMotion } from '../../../hooks/useDevice';
import { useScrollLock } from '../../../hooks/useSmoothScroll';
import { RollText } from '../RollText/RollText';
import styles from './Lightbox.module.css';

const CLOSE_TIME_SCALE = 1.5;

type LightboxProps = {
  src: string;
  alt: string;
  onClose: () => void;
  /** Küçük yazılı belgeler ekrana sığdırılmaz, gerçek boyutunda açılır ve kaydırılır. */
  isDocument?: boolean;
};

/**
 * Görseli tam ekran gösterir. Yapışık bölümlerdeki transform'lardan etkilenmemesi için `body` altına kurulur.
 * Yerel `dialog` kullanılmaz, üst katmana çıkıp özel imlecin altında kalırdı.
 */
export function Lightbox({ src, alt, onClose, isDocument = false }: LightboxProps) {
  const { t, i18n } = useTranslation();
  const prefersReducedMotion = usePrefersReducedMotion();
  const rootRef = useRef<HTMLDivElement>(null);
  const curtainRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const timelineRef = useRef<gsap.core.Timeline | null>(null);

  useScrollLock(true);

  // Perde hareketi burada da tekrar eder: siyah zemin alttan dolar, görsel üstüne oturur.
  useGSAP(
    () => {
      if (prefersReducedMotion || !curtainRef.current || !imageRef.current || !closeButtonRef.current) return;

      timelineRef.current = gsap
        .timeline({ defaults: { ease: MOTION.ease, duration: MOTION.base } })
        .from(curtainRef.current, { scaleY: 0 }, 0)
        .from(imageRef.current, { y: 48, autoAlpha: 0 }, MOTION.stagger * 2)
        // Gizli öğeye odak verilemediği için yalnızca opaklık değişir.
        .from(closeButtonRef.current, { opacity: 0 }, MOTION.stagger * 2);
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

  // Tek odaklanılabilir öğe kapatma düğmesi olduğu için Tab burada sabitlenir.
  useEffect(() => {
    const previouslyFocused = document.activeElement;
    closeButtonRef.current?.focus({ preventScroll: true });

    return () => {
      if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus({ preventScroll: true });
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
      if (event.key === 'Tab') event.preventDefault();
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [close]);

  // Görselin kendisine tıklamak kapatmaz, çevresindeki zemine tıklamak kapatır.
  const handleBackdropClick = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target !== imageRef.current) close();
  };

  return createPortal(
    <div ref={rootRef} className={styles.root} role="dialog" aria-modal="true" aria-label={alt}>
      <div ref={curtainRef} className={styles.curtain} />

      <div
        className={`${styles.stage} ${isDocument ? styles.documentStage : ''}`}
        onClick={handleBackdropClick}
        data-lenis-prevent={isDocument ? true : undefined}
      >
        <img ref={imageRef} className={`${styles.image} ${isDocument ? styles.documentImage : ''}`} src={src} alt={alt} />
      </div>

      <button ref={closeButtonRef} className={styles.close} type="button" aria-label={t('a11y.close')} onClick={close}>
        <span className={styles.closeMark} aria-hidden="true" />
        <span className={styles.closeLabel}>
          <RollText text={t('a11y.close').toLocaleUpperCase(i18n.language)} />
        </span>
      </button>
    </div>,
    document.body,
  );
}
