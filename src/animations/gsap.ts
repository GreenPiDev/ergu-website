import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { CustomEase } from 'gsap/CustomEase';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';

gsap.registerPlugin(useGSAP, CustomEase, ScrollTrigger, SplitText);

// tokens.css içindeki --ease-out ile aynı eğri.
CustomEase.create('brandOut', '0.7, 0, 0.15, 1');

export const MOTION = {
  ease: 'brandOut',
  fast: 0.3,
  base: 0.45,
  slow: 0.8,
  stagger: 0.05,
  curtain: 0.65,
  curtainLabelDelay: 0.12,
  curtainHold: 0.3,
  // Perde kalkmaya başlarken yeni sayfanın giriş animasyonu bu kadar bekler.
  curtainReveal: 0.6,
  // "Kaydır" belirtecindeki harf silindirleri.
  scrollCueStep: 0.6,
  scrollCueStagger: 0.065,
  scrollCuePause: 0.55,
} as const;

export { gsap, ScrollTrigger, SplitText, useGSAP };
