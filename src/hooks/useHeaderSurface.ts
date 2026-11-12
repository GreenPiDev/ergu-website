import { type RefObject, useEffect, useState } from 'react';
import { useLocation } from 'react-router';

export type Surface = 'dark' | 'light';

function isSurface(value: string | undefined): value is Surface {
  return value === 'dark' || value === 'light';
}

/**
 * Header'ın dikey ortasından geçen 1 px'lik çizgiyi izler ve o çizginin üzerindeki
 * `data-surface` bölümünün zeminini döndürür.
 */
export function useHeaderSurface(headerRef: RefObject<HTMLElement | null>): Surface {
  const { pathname } = useLocation();
  const [surface, setSurface] = useState<Surface>('dark');

  useEffect(() => {
    const header = headerRef.current;
    const sections = document.querySelectorAll<HTMLElement>('main [data-surface]');
    if (!header || sections.length === 0) return;

    let observer: IntersectionObserver | undefined;

    const observe = () => {
      observer?.disconnect();
      const { top, height } = header.getBoundingClientRect();
      const line = Math.round(top + height / 2);

      observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            const next = (entry.target as HTMLElement).dataset.surface;
            if (entry.isIntersecting && isSurface(next)) setSurface(next);
          }
        },
        { rootMargin: `-${line}px 0px -${Math.max(window.innerHeight - line - 1, 0)}px 0px` },
      );

      sections.forEach((section) => observer?.observe(section));
    };

    observe();
    window.addEventListener('resize', observe);

    return () => {
      window.removeEventListener('resize', observe);
      observer?.disconnect();
    };
  }, [headerRef, pathname]);

  return surface;
}
