import { type RefObject, useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { flashEntryMark } from '../../animations/knowledge';
import { revealWordsOnScroll } from '../../animations/reveal';
import { gsap, useGSAP } from '../../animations/gsap';
import type { ChapterKey } from '../../content/knowledge';
import { usePrefersReducedMotion } from '../../hooks/useDevice';
import { useSmoothScroll } from '../../hooks/useSmoothScroll';
import type trKnowledge from '../../locales/tr/knowledge.json';

export type EntryText = {
  title: string;
  short?: string;
  lead?: string;
  verdict?: string;
  body?: string[];
  listIntro?: string;
  list?: string[];
  callout?: string;
  outro?: string[];
  more?: string;
  columns?: string[];
  rows?: { type: string; use: string }[];
  steps?: { title: string; text: string }[];
};

type KnowledgeBundle = Omit<typeof trKnowledge, 'entries' | 'chapters'> & {
  entries: Record<string, EntryText>;
  chapters: Record<ChapterKey, { title: string; short: string; intro?: string }>;
};

// Her maddenin yapısı farklı olduğu için metinler tek tek anahtar yerine dilin paketinden okunur.
export function useKnowledge(): KnowledgeBundle {
  const { i18n } = useTranslation('knowledge');
  return i18n.getResourceBundle(i18n.language, 'knowledge');
}

type JumpOptions = {
  immediate?: boolean;
};

/** Sayfa içi atlama: adresi günceller, maddeye kaydırır, işaret yakar ve odağı oraya taşır. */
export function useEntryJump() {
  const lenisRef = useSmoothScroll();
  const prefersReducedMotion = usePrefersReducedMotion();

  return useCallback(
    (slug: string, { immediate = false }: JumpOptions = {}) => {
      const element = document.getElementById(slug);
      if (!element) return;

      // Router'a haber verilmez, aynı sayfa içinde perde veya yeniden çizim olmasın.
      window.history.replaceState(window.history.state, '', `#${slug}`);
      element.focus({ preventScroll: true });

      const onArrive = () => {
        const mark = element.querySelector('[data-entry-mark]');
        if (mark && !prefersReducedMotion) flashEntryMark(mark);
      };

      const margin = Number.parseFloat(getComputedStyle(element).scrollMarginTop) || 0;
      const target = element.getBoundingClientRect().top + window.scrollY - margin;

      if (lenisRef.current) {
        lenisRef.current.scrollTo(target, { force: true, immediate, onComplete: onArrive });
      } else {
        window.scrollTo(0, target);
        onArrive();
      }
    },
    [lenisRef, prefersReducedMotion],
  );
}

// Bir madde, ekranın bu yüksekliğindeki ince çizgiden geçerken etkin sayılır.
const ACTIVE_LINE_MARGIN = '-55% 0px -44.9% 0px';

/** Kapsayıcıdaki maddelerden okuma çizgisinin üzerinde olanın sırası. Boşlukta sonuncusu korunur. */
export function useActiveEntry(containerRef: RefObject<HTMLElement | null>): number {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const entries = Array.from(container.querySelectorAll('[data-entry]'));
    const observer = new IntersectionObserver(
      (records) => {
        for (const record of records) {
          if (record.isIntersecting) setActiveIndex(entries.indexOf(record.target));
        }
      },
      { rootMargin: ACTIVE_LINE_MARGIN },
    );

    entries.forEach((entry) => observer.observe(entry));
    return () => observer.disconnect();
  }, [containerRef]);

  return activeIndex;
}

/** Bölüm başlıklarının ekrana girişi. Her bölümde yalnızca bu hareket vardır, okumayı bölmez. */
export function useChapterReveal(scopeRef: RefObject<HTMLElement | null>) {
  const { i18n } = useTranslation();
  const prefersReducedMotion = usePrefersReducedMotion();

  useGSAP(
    () => {
      if (prefersReducedMotion) return;
      gsap.utils.toArray<HTMLElement>('[data-chapter-title]').forEach(revealWordsOnScroll);
    },
    { scope: scopeRef, dependencies: [i18n.language, prefersReducedMotion], revertOnUpdate: true },
  );
}
