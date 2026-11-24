import { type PointerEvent, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { gsap, MOTION, useGSAP } from '../../animations/gsap';
import { usePrefersReducedMotion } from '../../hooks/useDevice';
import { useScrollLock } from '../../hooks/useSmoothScroll';
import { RollText } from '../ui/RollText/RollText';
import { wrapIndex } from './carouselController';
import type { ScreenRect } from './cylinderLayout';
import { type GalleryImage, getImageAlt } from './galleryApi';
import { GalleryArrow } from './GalleryArrow';
import { GalleryCounter } from './GalleryCounter';
import styles from './GalleryLightbox.module.css';

// Parmak bu kadar (px) yatay kayarsa önceki/sonraki fotoğrafa geçilir.
const SWIPE_DISTANCE = 48;
// Fotoğraf değişirken yeni fotoğraf bu kadar (px) yandan gelir.
const SWAP_OFFSET = 48;
const FOCUSABLE_SELECTOR = 'button:not([disabled])';

interface GalleryLightboxProps {
  images: readonly GalleryImage[];
  index: number;
  onNavigate: (index: number) => void;
  onClose: () => void;
  /** Silindirdeki öndeki panelin ekrandaki yeri (viewport pikseli). Fotoğraf buradan büyür, kapanınca buraya döner. */
  getOriginRect: () => ScreenRect | null;
}

interface Size {
  width: number;
  height: number;
}

/** Fotoğrafı, oranını koruyarak sahnenin içine sığdırır (object-fit: contain). */
function containSize(image: GalleryImage, box: Size): Size {
  const scale = Math.min(box.width / image.width, box.height / image.height);
  return { width: Math.round(image.width * scale), height: Math.round(image.height * scale) };
}

/** Fotoğrafı silindirdeki paneline oturtan transform (FLIP'in "first" adımı). */
function originTransform(image: HTMLElement, origin: ScreenRect) {
  const rect = image.getBoundingClientRect();
  // Panel fotoğrafı kırparak gösterir: fotoğraf paneli tamamen örtecek kadar küçülür.
  const scale = Math.max(origin.width / rect.width, origin.height / rect.height);
  return {
    x: origin.left + origin.width / 2 - (rect.left + rect.width / 2),
    y: origin.top + origin.height / 2 - (rect.top + rect.height / 2),
    scale,
  };
}

/**
 * Galerinin tam ekran görünümü. Fotoğraf silindirdeki yerinden büyüyerek açılır; oklar, ok tuşları ve kaydırma ile
 * gezilir, kapanınca silindirdeki yerine küçülerek döner. Yerel `dialog` kullanılmaz, özel imlecin altında kalırdı.
 */
export function GalleryLightbox({ images, index, onNavigate, onClose, getOriginRect }: GalleryLightboxProps) {
  const { t, i18n } = useTranslation(['gallery', 'common']);
  const prefersReducedMotion = usePrefersReducedMotion();
  const rootRef = useRef<HTMLDivElement>(null);
  const curtainRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const closingRef = useRef(false);
  const swapDirection = useRef<1 | -1 | 0>(0);
  const swipe = useRef<{ id: number; x: number; y: number } | null>(null);
  const [box, setBox] = useState<Size | null>(null);

  useScrollLock(true);

  const image = images[index];
  const size = box ? containSize(image, box) : null;
  const alt = getImageAlt(image, i18n.language) ?? t('imageAlt', { number: index + 1 });

  // Sahnenin iç alanı ölçülür, fotoğrafın boyutu buna göre hesaplanır (ölçüler veriden geldiği için inmeden bilinir).
  useLayoutEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const measure = () => {
      const style = getComputedStyle(stage);
      setBox({
        width: stage.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight),
        height: stage.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom),
      });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(stage);
    return () => observer.disconnect();
  }, []);

  // Açılış: kâğıt perde alttan dolar, fotoğraf silindirdeki panelinden büyüyerek yerine oturur.
  const opened = useRef(false);
  useGSAP(
    () => {
      if (opened.current || !size || !curtainRef.current || !imageRef.current) return;
      opened.current = true;
      const controls = gsap.utils.toArray<HTMLElement>('[data-lightbox-control]', rootRef.current);
      if (prefersReducedMotion) {
        gsap.from([curtainRef.current, imageRef.current, ...controls], { opacity: 0, duration: MOTION.fast });
        return;
      }

      const origin = getOriginRect();
      const timeline = gsap.timeline({ defaults: { ease: MOTION.ease, duration: MOTION.slow } });
      timeline.from(curtainRef.current, { scaleY: 0, duration: MOTION.base }, 0);
      if (origin) timeline.from(imageRef.current, { ...originTransform(imageRef.current, origin) }, 0);
      else timeline.from(imageRef.current, { y: SWAP_OFFSET, autoAlpha: 0 }, MOTION.stagger * 2);
      // Gizli öğeye odak verilemediği için yalnızca opaklık değişir.
      timeline.from(controls, { opacity: 0, duration: MOTION.base, stagger: MOTION.stagger }, MOTION.base);
    },
    { scope: rootRef, dependencies: [size !== null] },
  );

  // Fotoğraf değişince yeni fotoğraf gidiş yönünden kayarak gelir.
  useGSAP(
    () => {
      const direction = swapDirection.current;
      if (direction === 0 || !imageRef.current) return;
      swapDirection.current = 0;
      if (prefersReducedMotion) return;
      gsap.fromTo(
        imageRef.current,
        { x: direction * SWAP_OFFSET, opacity: 0 },
        { x: 0, opacity: 1, duration: MOTION.base, ease: MOTION.ease },
      );
    },
    { scope: rootRef, dependencies: [index] },
  );

  const close = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    const curtain = curtainRef.current;
    const img = imageRef.current;
    const controls = gsap.utils.toArray<HTMLElement>('[data-lightbox-control]', rootRef.current);
    if (prefersReducedMotion || !curtain || !img) {
      gsap.to(rootRef.current, { opacity: 0, duration: MOTION.fast, onComplete: onClose });
      return;
    }

    // Kapanırken panel yeniden ölçülür: tam ekranda gezildiyse silindir arkada o fotoğrafa dönmüştür.
    const origin = getOriginRect();
    gsap.killTweensOf([curtain, img, ...controls]);
    gsap
      .timeline({ defaults: { ease: MOTION.ease, duration: MOTION.base }, onComplete: onClose })
      .to(controls, { opacity: 0, duration: MOTION.fast }, 0)
      .to(img, origin ? { ...originTransform(img, origin), duration: MOTION.slow } : { y: SWAP_OFFSET, autoAlpha: 0 }, 0)
      .to(curtain, { scaleY: 0 }, MOTION.base * 0.6);
  }, [getOriginRect, onClose, prefersReducedMotion]);

  const navigate = useCallback(
    (direction: 1 | -1) => {
      if (closingRef.current) return;
      swapDirection.current = direction;
      onNavigate(wrapIndex(index + direction, images.length));
    },
    [images.length, index, onNavigate],
  );

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
      else if (event.key === 'ArrowLeft') navigate(-1);
      else if (event.key === 'ArrowRight') navigate(1);
      else if (event.key === 'Tab') {
        // Odak görünümün içinde döner.
        const focusable = Array.from(rootRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR) ?? []);
        if (focusable.length === 0) return;
        const current = focusable.indexOf(document.activeElement as HTMLElement);
        const next = wrapIndex(current + (event.shiftKey ? -1 : 1), focusable.length);
        event.preventDefault();
        focusable[next].focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [close, navigate]);

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    swipe.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
  };

  // Yatay kaydırma gezinir. Kaydırma olmadan fotoğrafın dışına dokunmak kapatır.
  const handlePointerUp = (event: PointerEvent<HTMLDivElement>) => {
    const start = swipe.current;
    swipe.current = null;
    if (!start || start.id !== event.pointerId) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (Math.abs(dx) > SWIPE_DISTANCE && Math.abs(dx) > Math.abs(dy)) navigate(dx < 0 ? 1 : -1);
    else if (Math.hypot(dx, dy) < 8 && event.target !== imageRef.current) close();
  };

  return createPortal(
    <div
      ref={rootRef}
      className={styles.root}
      role="dialog"
      aria-modal="true"
      aria-label={t('lightbox.label')}
      data-surface="light"
    >
      <div ref={curtainRef} className={styles.curtain} />

      <div
        ref={stageRef}
        className={styles.stage}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerCancel={() => {
          swipe.current = null;
        }}
      >
        {size && (
          <img
            key="photo"
            ref={imageRef}
            className={styles.image}
            src={image.url}
            alt={alt}
            width={size.width}
            height={size.height}
            style={{ inlineSize: size.width, blockSize: size.height }}
            draggable={false}
          />
        )}
      </div>

      <div className={styles.counter} data-lightbox-control>
        <GalleryCounter index={index} total={images.length} />
      </div>
      <p className={styles.srOnly} aria-live="polite">
        {t('announce', { current: index + 1, total: images.length })}
      </p>

      <div className={`${styles.arrow} ${styles.previous}`} data-lightbox-control>
        <GalleryArrow direction={-1} label={t('previous')} onClick={() => navigate(-1)} />
      </div>
      <div className={`${styles.arrow} ${styles.next}`} data-lightbox-control>
        <GalleryArrow direction={1} label={t('next')} onClick={() => navigate(1)} />
      </div>

      <button
        ref={closeButtonRef}
        className={styles.close}
        type="button"
        aria-label={t('common:a11y.close')}
        onClick={close}
        data-lightbox-control
      >
        <span className={styles.closeMark} aria-hidden="true" />
        <span className={styles.closeLabel}>
          <RollText text={t('common:a11y.close').toLocaleUpperCase(i18n.language)} />
        </span>
      </button>
    </div>,
    document.body,
  );
}
