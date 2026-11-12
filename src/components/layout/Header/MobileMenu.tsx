import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { NavLink, useLocation } from 'react-router';
import { gsap, MOTION, useGSAP } from '../../../animations/gsap';
import { NAV_ITEMS } from '../../../content/navigation';
import { REDUCED_MOTION_QUERY } from '../../../hooks/useDevice';
import { getLocaleFromPathname, localizePath } from '../../../i18n/locale';
import { LanguageSwitch } from './LanguageSwitch';
import styles from './MobileMenu.module.css';

type MobileMenuProps = {
  id: string;
  isOpen: boolean;
  onNavigate: () => void;
  /** Menü ekranı kapladığı sürece true olur, kapanış animasyonu bitince false döner. */
  onCoverChange: (isCovering: boolean) => void;
};

export function MobileMenu({ id, isOpen, onNavigate, onCoverChange }: MobileMenuProps) {
  const { t } = useTranslation();
  const locale = getLocaleFromPathname(useLocation().pathname);
  const rootRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<gsap.core.Timeline | null>(null);

  useGSAP(
    () => {
      timelineRef.current = gsap
        .timeline({
          paused: true,
          defaults: { ease: MOTION.ease },
          onReverseComplete: () => onCoverChange(false),
        })
        .fromTo(rootRef.current, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.01, ease: 'none' }, 0)
        .fromTo(
          rootRef.current,
          { clipPath: 'inset(0% 0% 100% 0%)' },
          { clipPath: 'inset(0% 0% 0% 0%)', duration: MOTION.slow },
          0,
        )
        .fromTo(
          '[data-menu-reveal]',
          { yPercent: 115 },
          { yPercent: 0, duration: MOTION.slow, stagger: MOTION.stagger },
          0.18,
        );
    },
    { scope: rootRef },
  );

  useEffect(() => {
    const timeline = timelineRef.current;
    if (!timeline) return;

    if (isOpen) onCoverChange(true);

    if (window.matchMedia(REDUCED_MOTION_QUERY).matches) {
      timeline.progress(isOpen ? 1 : 0);
      if (!isOpen) onCoverChange(false);
      return;
    }

    if (isOpen) timeline.timeScale(1).play();
    else timeline.timeScale(1.5).reverse();
  }, [isOpen, onCoverChange]);

  useEffect(() => () => onCoverChange(false), [onCoverChange]);

  return (
    <div id={id} ref={rootRef} className={styles.menu} data-surface="dark" data-lenis-prevent>
      <nav aria-label={t('nav.label')}>
        <ul className={styles.list}>
          {NAV_ITEMS.map(({ key, path }) => (
            <li key={key} className={styles.item}>
              <NavLink
                className={({ isActive }) => `${styles.link} ${isActive ? styles.active : ''}`}
                to={localizePath(path, locale)}
                end={path === '/'}
                onClick={onNavigate}
              >
                <span className={styles.reveal} data-menu-reveal>
                  {t(`nav.items.${key}`)}
                </span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <div className={styles.footer}>
        <div className={styles.item}>
          <div className={styles.reveal} data-menu-reveal>
            <LanguageSwitch />
          </div>
        </div>
      </div>
    </div>
  );
}
