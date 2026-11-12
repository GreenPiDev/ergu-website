import { MOTION } from './gsap';

/** Sayfaya perdeyle gelindiyse giriş animasyonları perde kalkana kadar bekler. */
export function getPageIntroDelay(): number {
  return document.documentElement.dataset.pageCurtain ? MOTION.curtainReveal : 0.1;
}
