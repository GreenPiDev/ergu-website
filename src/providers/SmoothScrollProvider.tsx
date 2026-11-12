import Lenis from 'lenis';
import { type ReactNode, useEffect, useLayoutEffect, useRef } from 'react';
import { useLocation } from 'react-router';
import { gsap, ScrollTrigger } from '../animations/gsap';
import { usePrefersReducedMotion } from '../hooks/useDevice';
import { SmoothScrollContext } from '../hooks/useSmoothScroll';
import { stripLocale } from '../i18n/locale';

export function SmoothScrollProvider({ children }: { children: ReactNode }) {
  const lenisRef = useRef<Lenis | null>(null);
  const prefersReducedMotion = usePrefersReducedMotion();
  const route = stripLocale(useLocation().pathname);
  const previousRouteRef = useRef(route);

  useEffect(() => {
    if (prefersReducedMotion) return;

    // Dokunmatik cihazlarda Lenis varsayılan olarak doğal scroll'a dokunmaz.
    const lenis = new Lenis({ autoRaf: false });
    lenisRef.current = lenis;
    lenis.on('scroll', ScrollTrigger.update);

    const tick = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);

    return () => {
      gsap.ticker.remove(tick);
      lenis.destroy();
      lenisRef.current = null;
    };
  }, [prefersReducedMotion]);

  // Dil değişiminde konum korunur, yalnızca gerçek sayfa değişiminde başa dönülür.
  useLayoutEffect(() => {
    if (previousRouteRef.current === route) return;
    previousRouteRef.current = route;

    if (lenisRef.current) lenisRef.current.scrollTo(0, { immediate: true, force: true });
    else window.scrollTo(0, 0);
  }, [route]);

  return <SmoothScrollContext value={lenisRef}>{children}</SmoothScrollContext>;
}
