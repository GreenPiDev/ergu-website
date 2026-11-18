import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { type FacilityId, facilityColorToken } from '../../../content/facilities';
import { usePageRevealHold } from '../../../animations/pageReveal';
import { useIsMobile, usePrefersReducedMotion } from '../../../hooks/useDevice';
import { FacilityBar } from '../FacilityBar/FacilityBar';
import { setCursorLabel } from '../../ui/CustomCursor/cursorEvents';
import type { Quality } from './cityRuntime';
import styles from './CityHero.module.css';

// three.js ve sahne ana pakete girmez, ayrı parça olarak iner.
const CityCanvas = lazy(() => import('./CityCanvas'));

interface NavigatorWithMemory extends Navigator {
  deviceMemory?: number;
}

function getQuality(isMobile: boolean): Quality {
  const lowMemory = ((navigator as NavigatorWithMemory).deviceMemory ?? 8) <= 4;
  if (isMobile) return lowMemory ? 'low' : 'medium';
  return 'high';
}

/**
 * Çözünürlük üst sınırı. Masaüstünde 1 (imleç akıcılığı için kullanıcı kararı). Telefonların piksel oranı 3 olduğundan
 * 1'de sahne ekranın üçte biri çözünürlükte çizilip büyütülüyor ve bulanık görünüyordu. 2 net ama takılıyordu, 1.5
 * netlik ile akıcılık arasındaki denge (kullanıcı geri bildirimi). Zayıf cihazlarda 1.25.
 */
function getMaxDpr(isMobile: boolean, quality: Quality): number {
  if (!isMobile) return 1;
  return quality === 'low' ? 1.25 : 1.5;
}

/** Tam ekran 3D şehir. Poster yok: sahne hemen yüklenir, ilk kareler hazır olunca koyu zeminden solarak gelir. */
export function CityHero() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();
  const reducedMotion = usePrefersReducedMotion();
  const quality = getQuality(isMobile);
  const [ready, setReady] = useState(false);
  // Perdeyle gelindiyse perde, şehrin ilk kareleri çizilene kadar kalkmaz (ikonun çevresindeki yaylar döner).
  usePageRevealHold(ready);
  const [onScreen, setOnScreen] = useState(true);
  const [tabVisible, setTabVisible] = useState(true);
  const [facility, setFacility] = useState<FacilityId | null>(null);
  // Fareyle üstünde durulan buton: perdesi seçili perdeyle birlikte açılır, seçimi değiştirmez.
  const [preview, setPreview] = useState<FacilityId | null>(null);
  // Görünümü sıfırla: seçim kalkar, kamera ilk kadraja döner (yakınlaşma, sürükleme ve yörünge açısı sıfırlanır).
  const [resetSignal, setResetSignal] = useState(0);
  const resetView = useCallback(() => {
    setFacility(null);
    setResetSignal((value) => value + 1);
  }, []);
  const { t } = useTranslation();
  // Şehirde fareyle tesisin üstüne gelince perde açılır ve imlecin yanında tesisin adı, tesisin renginde yazar.
  // Butonlarda etiket yok: adı zaten butonda yazıyor.
  const hoverFromCity = useCallback(
    (hovered: FacilityId | null) => {
      setPreview(hovered);
      setCursorLabel(
        hovered ? { text: t(`home.facilities.items.${hovered}`), color: `var(${facilityColorToken(hovered)})` } : null,
      );
    },
    [t],
  );
  // Şehirde tesise tıklamak butonla aynı: seçer, seçili olana yeniden tıklamak veya boş yere tıklamak seçimi kaldırır.
  const pickFromCity = useCallback(
    (picked: FacilityId | null) => setFacility((current) => (picked === null || picked === current ? null : picked)),
    [],
  );
  const shown = useMemo(
    () => [facility, preview].filter((id, index, list): id is FacilityId => id !== null && list.indexOf(id) === index),
    [facility, preview],
  );

  // Yalnızca ekranda ve sekme açıkken çizilir.
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const observer = new IntersectionObserver(([entry]) => setOnScreen(entry.isIntersecting), { threshold: 0.01 });
    observer.observe(wrap);
    const onVisibility = () => setTabVisible(!document.hidden);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      observer.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  return (
    // Hero'da özel imleç karışımsız çizilir: 3D tuvalin üstündeki karışım kareyi uzatıyordu (CustomCursor).
    <div ref={wrapRef} className={styles.root} data-cursor-blend="off">
      <Suspense fallback={null}>
        <CityCanvas
          className={styles.canvas}
          active={onScreen && tabVisible}
          ready={ready}
          quality={quality}
          maxDpr={getMaxDpr(isMobile, quality)}
          reducedMotion={reducedMotion}
          onReady={() => setReady(true)}
          facilities={shown}
          focus={facility}
          resetSignal={resetSignal}
          onHoverFacility={hoverFromCity}
          onPickFacility={pickFromCity}
        />
      </Suspense>
      <FacilityBar selected={facility} onSelect={setFacility} onPreview={setPreview} onReset={resetView} />
    </div>
  );
}
