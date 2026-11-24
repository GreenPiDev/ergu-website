import {
  type KeyboardEvent,
  lazy,
  type PointerEvent,
  Suspense,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { useDevice, useHasFinePointer, usePrefersReducedMotion } from '../../hooks/useDevice';
import { setCursorInteractive, setCursorLabel } from '../ui/CustomCursor/cursorEvents';
import { CarouselController } from './carouselController';
import { LAYOUTS, type ScreenRect } from './cylinderLayout';
import type { GalleryImage } from './galleryApi';
import { GalleryArrow } from './GalleryArrow';
import type { GalleryCanvasHandle, GalleryColors } from './GalleryCanvas';
import { GalleryCounter } from './GalleryCounter';
import { GalleryLightbox } from './GalleryLightbox';
import { GalleryThumbnails } from './GalleryThumbnails';
import styles from './GalleryCarousel.module.css';

// three.js ve sahne ana pakete girmez, ayrı parça olarak iner.
const GalleryCanvas = lazy(() => import('./GalleryCanvas'));

// Tekerlekte bu kadar piksellik kaydırma bir fotoğraf döndürür.
const WHEEL_PX_PER_ITEM = 240;
// İşaretçi bu kadar (px) kaymadan sürükleme başlamaz, öncesi tıklamadır.
const DRAG_THRESHOLD = 6;
// Sürüklemede öndeki panelin genişliğinin bu kadarı bir fotoğraf döndürür.
const DRAG_PANEL_RATIO = 0.9;
// Bırakmadan önce işaretçi bu kadar (ms) durduysa savrulma olmaz.
const FLING_IDLE_MS = 90;
// Silindir dururken öndeki fotoğrafa tıklamak tam ekran açar; hâlâ dönüyorsa önce yerine oturur.
const SETTLED_EPSILON = 0.15;
// Ekran okuyucu, silindir durduktan sonra öndeki fotoğrafı duyar (kayarken geçilen her fotoğrafı değil).
const ANNOUNCE_DELAY_MS = 450;

interface DragState {
  id: number;
  type: string;
  startX: number;
  startY: number;
  lastX: number;
  lastTime: number;
  velocity: number;
  axis: 'x' | 'y' | null;
}

type CursorState = 'none' | 'drag' | 'view' | 'panel';

/**
 * Fotoğrafların silindir üzerinde döndüğü galeri. Silindir tekerlek, sürükleme, oklar ve ok tuşlarıyla döner; alttaki
 * şeritten seçilen fotoğrafa kayarak gidilir. Öndeki fotoğrafa tıklamak tam ekran görünümü açar.
 */
interface GalleryCarouselProps {
  images: readonly GalleryImage[];
  /** Öndeki fotoğraflar çizilince bir kez çağrılır (sayfa geçişi perdesi bunu bekler). */
  onReady: () => void;
}

export function GalleryCarousel({ images, onReady }: GalleryCarouselProps) {
  const { t, i18n } = useTranslation('gallery');
  const device = useDevice();
  const layout = LAYOUTS[device];
  const prefersReducedMotion = usePrefersReducedMotion();
  const hasFinePointer = useHasFinePointer();
  const rootRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasHandleRef = useRef<GalleryCanvasHandle | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const cursorRef = useRef<CursorState>('none');
  const [activeIndex, setActiveIndex] = useState(0);
  const [isLightboxOpen, setLightboxOpen] = useState(false);
  const [isReady, setReady] = useState(false);
  const [colors, setColors] = useState<GalleryColors | null>(null);
  const [isOnScreen, setOnScreen] = useState(true);
  const [isTabVisible, setTabVisible] = useState(true);
  const [announcedIndex, setAnnouncedIndex] = useState(0);

  useEffect(() => {
    const timer = window.setTimeout(() => setAnnouncedIndex(activeIndex), ANNOUNCE_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [activeIndex]);

  const controller = useMemo(() => new CarouselController(images.length, setActiveIndex), [images.length]);
  useEffect(() => () => controller.destroy(), [controller]);
  useEffect(() => {
    controller.setReducedMotion(prefersReducedMotion);
  }, [controller, prefersReducedMotion]);

  // Silindirin renkleri bölümün token'larından okunur: arkadaki paneller zemine doğru solar.
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const style = getComputedStyle(root);
    setColors({
      background: style.getPropertyValue('--surface-bg').trim(),
      placeholder: style.getPropertyValue('--color-gallery-placeholder').trim(),
    });
  }, []);

  // Yalnızca ekranda ve sekme açıkken çizilir.
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const observer = new IntersectionObserver(([entry]) => setOnScreen(entry.isIntersecting), { threshold: 0.01 });
    observer.observe(stage);
    const onVisibility = () => setTabVisible(!document.hidden);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      observer.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  // İmleç silindirin üstündeyken tekerlek sayfayı değil silindiri döndürür. React'in tekerlek olayı pasif olduğu için
  // varsayılan kaydırma ancak doğrudan dinleyiciyle engellenir. Lenis bu alanı `data-lenis-prevent` ile atlar.
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const unit = event.deltaMode === 1 ? 32 : event.deltaMode === 2 ? stage.clientHeight : 1;
      const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
      controller.nudge((delta * unit) / WHEEL_PX_PER_ITEM);
    };
    stage.addEventListener('wheel', onWheel, { passive: false });
    return () => stage.removeEventListener('wheel', onWheel);
  }, [controller]);

  const setCursor = useCallback(
    (next: CursorState) => {
      if (cursorRef.current === next) return;
      cursorRef.current = next;
      setCursorInteractive(next === 'view' || next === 'panel');
      const label = next === 'drag' ? t('cursor.drag') : next === 'view' ? t('cursor.view') : null;
      setCursorLabel(label ? { text: label.toLocaleUpperCase(i18n.language) } : null);
    },
    [t, i18n.language],
  );
  useEffect(() => () => setCursor('none'), [setCursor]);

  const localPoint = (event: PointerEvent<HTMLElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  const updateHover = (event: PointerEvent<HTMLDivElement>) => {
    if (!hasFinePointer || event.pointerType !== 'mouse') return;
    const { x, y } = localPoint(event);
    const hit = canvasHandleRef.current?.hitTest(x, y) ?? null;
    if (hit === null) setCursor('drag');
    else setCursor(hit === controller.activeRawIndex ? 'view' : 'panel');
  };

  const pixelsPerItem = () => (stageRef.current?.clientWidth ?? window.innerWidth) * layout.frontWidth * DRAG_PANEL_RATIO;

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || isLightboxOpen) return;
    dragRef.current = {
      id: event.pointerId,
      type: event.pointerType,
      startX: event.clientX,
      startY: event.clientY,
      lastX: event.clientX,
      lastTime: event.timeStamp,
      velocity: 0,
      axis: null,
    };
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.id !== event.pointerId) {
      updateHover(event);
      return;
    }

    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    if (drag.axis === null) {
      if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
      // Dokunmada dikey hareket sayfanın doğal kaydırmasıdır, silindir karışmaz. Farede her yön sürüklemedir.
      drag.axis = drag.type === 'mouse' || Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
      if (drag.axis === 'y') {
        dragRef.current = null;
        return;
      }
      event.currentTarget.setPointerCapture(event.pointerId);
      controller.dragStart();
      setCursor('drag');
    }

    const perItem = pixelsPerItem();
    controller.dragMove(-dx / perItem);
    const elapsed = Math.max(1, event.timeStamp - drag.lastTime) / 1000;
    const instant = -(event.clientX - drag.lastX) / perItem / elapsed;
    // Hız yumuşatılır: tek bir titrek olay savrulmayı belirlemesin.
    drag.velocity = drag.velocity * 0.6 + instant * 0.4;
    drag.lastX = event.clientX;
    drag.lastTime = event.timeStamp;
  };

  const handlePointerUp = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    dragRef.current = null;
    if (!drag || drag.id !== event.pointerId) return;

    if (drag.axis === 'x') {
      const idle = event.timeStamp - drag.lastTime > FLING_IDLE_MS;
      controller.dragEnd(idle ? 0 : drag.velocity);
      updateHover(event);
      return;
    }

    // Tıklama: öndeki fotoğraf tam ekran açılır, yandaki bir fotoğrafa tıklamak onu öne getirir.
    const { x, y } = localPoint(event);
    const hit = canvasHandleRef.current?.hitTest(x, y) ?? null;
    if (hit === null) return;
    if (hit === controller.activeRawIndex && Math.abs(controller.position - hit) < SETTLED_EPSILON) {
      setLightboxOpen(true);
    } else {
      controller.goToRaw(hit);
    }
  };

  const handlePointerCancel = () => {
    if (dragRef.current?.axis === 'x') controller.dragEnd(0);
    dragRef.current = null;
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (isLightboxOpen) return;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      controller.step(event.key === 'ArrowRight' ? 1 : -1);
    }
  };

  const handleStageKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      setLightboxOpen(true);
    }
  };

  /** Öndeki panelin ekrandaki yeri: tam ekran görünüm buradan açılır ve buraya kapanır. */
  const getOriginRect = useCallback((): ScreenRect | null => {
    const stage = stageRef.current;
    const rect = canvasHandleRef.current?.getActiveRect();
    if (!stage || !rect) return null;
    const stageRect = stage.getBoundingClientRect();
    return { ...rect, left: rect.left + stageRect.left, top: rect.top + stageRect.top };
  }, []);

  const navigateLightbox = useCallback(
    (index: number) => {
      // Silindir arkada aynı fotoğrafa geçer, görünüm kapanınca fotoğraf yerine döner.
      controller.jumpTo(index);
      setActiveIndex(index);
    },
    [controller],
  );

  const closeLightbox = useCallback(() => setLightboxOpen(false), []);
  const goToThumbnail = useCallback((index: number) => controller.goTo(index), [controller]);

  return (
    <section
      ref={rootRef}
      className={styles.root}
      data-surface="light"
      aria-roledescription="carousel"
      aria-label={t('label')}
      onKeyDown={handleKeyDown}
    >
      <div
        ref={stageRef}
        className={styles.stage}
        role="button"
        tabIndex={0}
        aria-label={t('stageLabel')}
        data-lenis-prevent
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onPointerLeave={() => setCursor('none')}
        onKeyDown={handleStageKeyDown}
      >
        <div className={styles.canvasLayer} data-ready={isReady}>
          {colors && (
            <Suspense fallback={null}>
              <GalleryCanvas
                className={styles.canvas}
                images={images}
                controller={controller}
                layout={layout}
                colors={colors}
                active={isOnScreen && isTabVisible}
                reducedMotion={prefersReducedMotion}
                handleRef={canvasHandleRef}
                onReady={() => {
                  setReady(true);
                  onReady();
                }}
              />
            </Suspense>
          )}
        </div>
      </div>

      <div className={styles.bar}>
        <GalleryCounter index={activeIndex} total={images.length} />
        <div className={styles.arrows}>
          <GalleryArrow direction={-1} label={t('previous')} onClick={() => controller.step(-1)} />
          <GalleryArrow direction={1} label={t('next')} onClick={() => controller.step(1)} />
        </div>
      </div>

      <GalleryThumbnails images={images} activeIndex={activeIndex} onSelect={goToThumbnail} />

      <p className={styles.srOnly} aria-live="polite">
        {t('announce', { current: announcedIndex + 1, total: images.length })}
      </p>

      {isLightboxOpen && (
        <GalleryLightbox
          images={images}
          index={activeIndex}
          onNavigate={navigateLightbox}
          onClose={closeLightbox}
          getOriginRect={getOriginRect}
        />
      )}
    </section>
  );
}
