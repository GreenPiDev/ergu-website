import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { FacilityId } from '../../../content/facilities';
import { useIsMobile, usePrefersReducedMotion } from '../../../hooks/useDevice';
import { FacilityBar } from '../FacilityBar/FacilityBar';
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

/** Tam ekran 3D şehir. Poster yok: sahne hemen yüklenir, ilk kareler hazır olunca koyu zeminden solarak gelir. */
export function CityHero() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();
  const reducedMotion = usePrefersReducedMotion();
  const [ready, setReady] = useState(false);
  const [onScreen, setOnScreen] = useState(true);
  const [tabVisible, setTabVisible] = useState(true);
  const [facility, setFacility] = useState<FacilityId | null>(null);
  // Fareyle üstünde durulan buton: perdesi seçili perdeyle birlikte açılır, seçimi değiştirmez.
  const [preview, setPreview] = useState<FacilityId | null>(null);
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
    <div ref={wrapRef} className={styles.root}>
      <Suspense fallback={null}>
        <CityCanvas
          className={styles.canvas}
          active={onScreen && tabVisible}
          ready={ready}
          quality={getQuality(isMobile)}
          reducedMotion={reducedMotion}
          onReady={() => setReady(true)}
          facilities={shown}
          focus={facility}
          onHoverFacility={setPreview}
          onPickFacility={pickFromCity}
        />
      </Suspense>
      <FacilityBar selected={facility} onSelect={setFacility} onPreview={setPreview} />
    </div>
  );
}
