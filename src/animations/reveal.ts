import { gsap, MOTION, SplitText } from './gsap';

// Öğe ekrana bu kadar girince açılır.
const REVEAL_START = 'top 88%';

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

/** Öğe ekrana girerken aşağıdan belirir. `useGSAP` içinde çağrılır. */
export function revealUpOnScroll(target: HTMLElement) {
  gsap.from(target, {
    y: 40,
    autoAlpha: 0,
    duration: MOTION.slow,
    ease: MOTION.ease,
    scrollTrigger: { trigger: target, start: REVEAL_START, once: true },
  });
}
