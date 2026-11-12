import { type ComponentProps, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { gsap, MOTION, useGSAP } from '../../../animations/gsap';
import { getPageIntroDelay } from '../../../animations/pageIntro';
import { usePrefersReducedMotion } from '../../../hooks/useDevice';
import styles from './ScrollCue.module.css';

/** Hero'nun altındaki "kaydır" belirteci. Harfler sayaç silindiri gibi döner, yanlarından çizgi akar. */
export function ScrollCue({ className = '', ...rest }: ComponentProps<'div'>) {
  const { t, i18n } = useTranslation();
  const prefersReducedMotion = usePrefersReducedMotion();
  const rootRef = useRef<HTMLDivElement>(null);

  // Harf sayısı dile göre değiştiği için silindirler dil değişince yeniden kurulur.
  useGSAP(
    () => {
      if (prefersReducedMotion) return;

      const timeline = gsap.timeline({
        repeat: -1,
        repeatDelay: MOTION.scrollCuePause,
        delay: getPageIntroDelay(),
      });
      const drums = gsap.utils.toArray<HTMLElement>('[data-scroll-cue-drum]');
      const step = { duration: MOTION.scrollCueStep, ease: MOTION.ease, stagger: MOTION.scrollCueStagger };
      const stepLength = MOTION.scrollCueStep + MOTION.scrollCueStagger * (drums.length - 1);
      const secondStepStart = stepLength + MOTION.scrollCuePause;

      // Çizgi her harf dönüşüyle aynı anda başlar ve biter.
      const runnerPass = { yPercent: 100, duration: stepLength, ease: MOTION.ease };

      // Son kopya ilk haliyle aynı olduğu için döngü başa dönerken sıçrama olmaz.
      timeline
        .to(drums, { yPercent: 100, ...step }, 0)
        .fromTo('[data-scroll-cue-runner]', { yPercent: -100 }, runnerPass, 0)
        .to(drums, { yPercent: 200, ...step }, secondStepStart)
        .fromTo('[data-scroll-cue-runner]', { yPercent: -100 }, runnerPass, secondStepStart);
    },
    { scope: rootRef, dependencies: [i18n.language, prefersReducedMotion], revertOnUpdate: true },
  );

  return (
    <div {...rest} ref={rootRef} className={`${styles.cue} ${className}`} aria-hidden="true">
      <span className={styles.inner}>
        <span key={i18n.language} className={styles.word}>
          {Array.from(t('scrollCue').toLocaleUpperCase(i18n.language)).map((letter, index) => (
            <span key={index} className={styles.cell}>
              <span className={styles.drum} data-scroll-cue-drum>
                {letter}
                <span className={styles.glyphWhite}>{letter}</span>
                <span className={styles.glyphAccent}>{letter}</span>
              </span>
            </span>
          ))}
        </span>
        <span className={styles.track}>
          <span className={styles.runner} data-scroll-cue-runner />
        </span>
      </span>
    </div>
  );
}
