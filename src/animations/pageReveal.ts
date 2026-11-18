import { useLayoutEffect } from 'react';

// Sayfa geçişi perdesi, yeni sayfadaki bekletmeler bitene kadar kalkmaz (ör. ana sayfadaki 3D şehir).
const holds = new Set<symbol>();
const listeners = new Set<() => void>();

// Bir şey ters giderse (WebGL açılmaz, model inmez) perde sonsuza kadar ekranda kalmasın.
const MAX_HOLD_MS = 15000;

function notify() {
  if (holds.size > 0) return;
  listeners.forEach((listener) => listener());
  listeners.clear();
}

/** Perdenin kalkmasını bekletir. Dönen fonksiyon bekletmeyi bırakır. */
export function holdPageReveal(): () => void {
  const hold = Symbol('page-reveal-hold');
  holds.add(hold);
  return () => {
    if (holds.delete(hold)) notify();
  };
}

/** Bekletme yoksa hemen, varsa hepsi bitince çağırır. Dönen fonksiyon beklemeyi iptal eder. */
export function whenPageRevealReady(callback: () => void): () => void {
  if (holds.size === 0) {
    callback();
    return () => undefined;
  }
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}

/**
 * Sayfa hazır olana kadar perdeyi bekletir. Bileşen perdenin arkasında açıldığı commit'te bağlandığı için
 * layout effect kullanılır: perde kalkıp kalkmayacağına aynı commit'in effect'lerinde karar verir.
 */
export function usePageRevealHold(isReady: boolean) {
  useLayoutEffect(() => {
    if (isReady) return;
    const release = holdPageReveal();
    const timer = window.setTimeout(release, MAX_HOLD_MS);
    return () => {
      window.clearTimeout(timer);
      release();
    };
  }, [isReady]);
}
