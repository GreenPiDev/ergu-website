import { gsap, MOTION } from './gsap';

// Atlanan maddedeki işaretin ekranda kalma süresi.
const FLASH_HOLD = 1.1;

/** Aramadan veya "Bkz." bağlantısından gelince okuyucunun gözünü doğru maddeye götürür. */
export function flashEntryMark(mark: Element) {
  gsap.killTweensOf(mark);
  gsap
    .timeline()
    .fromTo(mark, { scaleY: 0, autoAlpha: 1 }, { scaleY: 1, duration: MOTION.base, ease: MOTION.ease })
    .to(mark, { autoAlpha: 0, duration: MOTION.base, ease: 'none' }, `+=${FLASH_HOLD}`);
}
