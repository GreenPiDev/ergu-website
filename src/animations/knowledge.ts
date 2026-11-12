import { gsap, MOTION, SplitText } from './gsap';

// Bölüm başlığı ekrana bu kadar girince açılır.
const REVEAL_START = 'top 88%';
// Atlanan maddedeki işaretin ekranda kalma süresi.
const FLASH_HOLD = 1.1;

/** Başlık kelimeleri maskesinden çıkar. `useGSAP` içinde çağrılır, font ve dil değişiminde yeniden bölünür. */
export function revealWordsOnScroll(target: HTMLElement) {
  SplitText.create(target, {
    type: 'words',
    mask: 'words',
    autoSplit: true,
    onSplit: (self) =>
      gsap.from(self.words, {
        yPercent: 130,
        duration: MOTION.slow,
        ease: MOTION.ease,
        stagger: MOTION.stagger,
        scrollTrigger: { trigger: target, start: REVEAL_START, once: true },
      }),
  });
}

/** Aramadan veya "Bkz." bağlantısından gelince okuyucunun gözünü doğru maddeye götürür. */
export function flashEntryMark(mark: Element) {
  gsap.killTweensOf(mark);
  gsap
    .timeline()
    .fromTo(mark, { scaleY: 0, autoAlpha: 1 }, { scaleY: 1, duration: MOTION.base, ease: MOTION.ease })
    .to(mark, { autoAlpha: 0, duration: MOTION.base, ease: 'none' }, `+=${FLASH_HOLD}`);
}
