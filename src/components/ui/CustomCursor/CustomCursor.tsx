import { useRef } from 'react';
import { gsap, useGSAP } from '../../../animations/gsap';
import { REDUCED_MOTION_QUERY, useHasFinePointer } from '../../../hooks/useDevice';
import styles from './CustomCursor.module.css';
import { CURSOR_INTERACTIVE_EVENT, CURSOR_LABEL_EVENT, type CursorLabel } from './cursorEvents';

const INTERACTIVE_SELECTOR = 'a, button, [role="button"], label, summary';
// Vurgu renkli bölümlerde vurgu renkli halka kaybolur, orada `--rail-solid-color` ile çizilir.
const ACCENT_SURFACE_SELECTOR = '[data-tone="accent"]';
const HIDE_NATIVE_CURSOR_CLASS = 'has-custom-cursor';
// Etiket halkanın sağında (ekranın sağ kenarına yakınsa solunda) durur: imleç merkezinden uzaklık (px). Çizgi halkanın
// hemen dışından başlar (tıklanabilir halde halka yarıçapı 25 px).
const LABEL_OFFSET = 28;
const LABEL_EDGE_MARGIN = 16;
// Halkalar büyük halleriyle çizilir, normalde küçültülür. Tersi olursa büyürken bulanıklaşır.
const RING_REST_SCALE = 0.72;

/** `quickTo`, iki özelliğe açılan `scale` kısayolunu çalıştırmaz, eksenler ayrı ayrı sürülür. */
function quickScale(element: HTMLElement, duration: number, ease: string) {
  const scaleX = gsap.quickTo(element, 'scaleX', { duration, ease });
  const scaleY = gsap.quickTo(element, 'scaleY', { duration, ease });

  return (value: number) => {
    scaleX(value);
    scaleY(value);
  };
}

function CursorElements() {
  const dotRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const accentRingRef = useRef<HTMLDivElement>(null);
  const labelRef = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    const dot = dotRef.current;
    const ring = ringRef.current;
    const accentRing = accentRingRef.current;
    const label = labelRef.current;
    if (!dot || !ring || !accentRing || !label) return;

    const isReduced = window.matchMedia(REDUCED_MOTION_QUERY).matches;
    const dotDuration = isReduced ? 0.001 : 0.1;
    const ringDuration = isReduced ? 0.001 : 0.4;
    const ease = 'power3.out';

    gsap.set([dot, ring, accentRing], { xPercent: -50, yPercent: -50 });
    gsap.set([ring, accentRing], { scale: RING_REST_SCALE });
    gsap.set(label, { yPercent: -50 });
    const labelX = gsap.quickTo(label, 'x', { duration: dotDuration * 2, ease });
    const labelY = gsap.quickTo(label, 'y', { duration: dotDuration * 2, ease });
    const labelOpacity = gsap.quickTo(label, 'opacity', { duration: 0.18, ease: 'none' });

    const dotX = gsap.quickTo(dot, 'x', { duration: dotDuration, ease });
    const dotY = gsap.quickTo(dot, 'y', { duration: dotDuration, ease });
    const dotOpacity = gsap.quickTo(dot, 'opacity', { duration: 0.2, ease: 'none' });
    const ringOpacity = gsap.quickTo(ring, 'opacity', { duration: 0.2, ease: 'none' });
    const accentRingOpacity = gsap.quickTo(accentRing, 'opacity', { duration: 0.2, ease: 'none' });

    // İki halka aynı konum ve ölçekte ilerler, yalnızca görünürlükleri değişir.
    const ringTrackers = [ring, accentRing].map((element) => ({
      x: gsap.quickTo(element, 'x', { duration: ringDuration, ease }),
      y: gsap.quickTo(element, 'y', { duration: ringDuration, ease }),
      scale: quickScale(element, 0.35, ease),
    }));

    let isVisible = false;
    let isInteractive = false;
    let isPressed = false;
    let hasLabel = false;
    let labelWidth = 0;
    const pointer = { x: 0, y: 0 };

    /** Etiket imlecin sağında, sağ kenara sığmazsa solunda. jump: süzülmeden yerine konur. */
    const placeLabel = (jump: boolean) => {
      const fitsRight = pointer.x + LABEL_OFFSET + labelWidth + LABEL_EDGE_MARGIN <= window.innerWidth;
      const x = fitsRight ? pointer.x + LABEL_OFFSET : pointer.x - LABEL_OFFSET - labelWidth;
      label.classList.toggle(styles.labelFlipped, !fitsRight);
      if (jump) {
        labelX(x, x);
        labelY(pointer.y, pointer.y);
      } else {
        labelX(x);
        labelY(pointer.y);
      }
    };

    const updateAppearance = () => {
      const ringScale = (isInteractive ? 1 : RING_REST_SCALE) * (isPressed ? 0.8 : 1);

      dotOpacity(isVisible ? 1 : 0);
      labelOpacity(isVisible && hasLabel ? 1 : 0);
      ringOpacity(isVisible && !isInteractive ? 1 : 0);
      accentRingOpacity(isVisible && isInteractive ? 1 : 0);
      ringTrackers.forEach((tracker) => tracker.scale(ringScale));
    };

    const setVisible = (visible: boolean) => {
      isVisible = visible;
      updateAppearance();
    };

    const handlePointerMove = (event: PointerEvent) => {
      const { clientX: x, clientY: y } = event;
      pointer.x = x;
      pointer.y = y;
      if (hasLabel) placeLabel(!isVisible);

      // Görünmez imleç yeniden belirirken eski konumdan süzülmesin.
      if (!isVisible) {
        dotX(x, x);
        dotY(y, y);
        ringTrackers.forEach((tracker) => {
          tracker.x(x, x);
          tracker.y(y, y);
        });
        setVisible(true);
        return;
      }

      dotX(x);
      dotY(y);
      ringTrackers.forEach((tracker) => {
        tracker.x(x);
        tracker.y(y);
      });
    };

    const handlePointerOver = (event: PointerEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      const interactive = target !== null && target.closest(INTERACTIVE_SELECTOR) !== null;

      // Renk geçişsiz değişir. Halka yalnızca tıklanabilir alanda göründüğü için fark edilmez.
      if (interactive) accentRing.classList.toggle(styles.onAccent, target.closest(ACCENT_SURFACE_SELECTOR) !== null);

      if (interactive === isInteractive) return;
      isInteractive = interactive;
      updateAppearance();
    };

    // 3D sahne gibi DOM dışı tıklanabilir alanlar (cursorEvents.ts).
    const handleExternalInteractive = (event: Event) => {
      const interactive = event instanceof CustomEvent && event.detail === true;
      if (interactive) accentRing.classList.remove(styles.onAccent);
      if (interactive === isInteractive) return;
      isInteractive = interactive;
      updateAppearance();
    };

    // Etiket metni geçişsiz değişir, görünür hale gelirken imlecin yanına süzülmeden konur.
    const handleLabel = (event: Event) => {
      const next = event instanceof CustomEvent ? (event.detail as CursorLabel | null) : null;
      if (next) {
        label.textContent = next.text;
        label.style.setProperty('--cursor-label-color', next.color ?? 'var(--color-accent)');
        labelWidth = label.offsetWidth;
        placeLabel(!hasLabel);
      }
      hasLabel = next !== null;
      updateAppearance();
    };

    const handlePointerPress = (pressed: boolean) => {
      isPressed = pressed;
      updateAppearance();
    };
    const handlePointerDown = () => handlePointerPress(true);
    const handlePointerUp = () => handlePointerPress(false);
    const handleLeave = () => setVisible(false);

    const root = document.documentElement;
    root.classList.add(HIDE_NATIVE_CURSOR_CLASS);
    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    window.addEventListener('pointerover', handlePointerOver, { passive: true });
    window.addEventListener('pointerdown', handlePointerDown, { passive: true });
    window.addEventListener('pointerup', handlePointerUp, { passive: true });
    window.addEventListener(CURSOR_INTERACTIVE_EVENT, handleExternalInteractive);
    window.addEventListener(CURSOR_LABEL_EVENT, handleLabel);
    root.addEventListener('mouseleave', handleLeave);

    return () => {
      root.classList.remove(HIDE_NATIVE_CURSOR_CLASS);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerover', handlePointerOver);
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener(CURSOR_INTERACTIVE_EVENT, handleExternalInteractive);
      window.removeEventListener(CURSOR_LABEL_EVENT, handleLabel);
      root.removeEventListener('mouseleave', handleLeave);
    };
  });

  return (
    <>
      <div ref={ringRef} className={styles.ring} aria-hidden="true" />
      <div ref={accentRingRef} className={styles.accentRing} aria-hidden="true" />
      <div ref={dotRef} className={styles.dot} aria-hidden="true" />
      <div ref={labelRef} className={styles.label} aria-hidden="true" />
    </>
  );
}

/** Yalnızca fare kullanan cihazlarda çalışır, dokunmatikte hiç render edilmez. */
export function CustomCursor() {
  return useHasFinePointer() ? <CursorElements /> : null;
}
