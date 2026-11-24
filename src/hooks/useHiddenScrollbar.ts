import { useLayoutEffect } from 'react';

/**
 * Sayfa açıkken tarayıcının scrollbar'ını gizler, sayfadan çıkınca geri getirir. Kaydırma çalışmaya devam eder,
 * yalnızca çubuk görünmez. Scrollbar'ın gizleneceği sayfada bir kez çağrılır, stil `base.css` içindedir
 * (`html[data-scrollbar='hidden']`).
 */
export function useHiddenScrollbar(): void {
  useLayoutEffect(() => {
    const root = document.documentElement;
    root.dataset.scrollbar = 'hidden';
    return () => {
      delete root.dataset.scrollbar;
    };
  }, []);
}
