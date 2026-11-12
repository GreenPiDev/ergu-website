import type Lenis from 'lenis';
import { createContext, type RefObject, useContext, useEffect } from 'react';

export const SmoothScrollContext = createContext<RefObject<Lenis | null> | null>(null);

export function useSmoothScroll(): RefObject<Lenis | null> {
  const context = useContext(SmoothScrollContext);
  if (!context) throw new Error('useSmoothScroll, SmoothScrollProvider içinde kullanılmalı.');
  return context;
}

export function useScrollLock(locked: boolean): void {
  const lenisRef = useSmoothScroll();

  useEffect(() => {
    if (!locked) return;

    const root = document.documentElement;
    const lenis = lenisRef.current;
    root.dataset.scrollLocked = 'true';
    lenis?.stop();

    return () => {
      delete root.dataset.scrollLocked;
      lenis?.start();
    };
  }, [locked, lenisRef]);
}
