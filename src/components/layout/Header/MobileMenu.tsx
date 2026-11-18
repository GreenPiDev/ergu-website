import { type ReactNode, useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { NavLink, useLocation } from 'react-router';
import { gsap, MOTION, useGSAP } from '../../../animations/gsap';
import { groupContainsPath, HEADER_NAV, type NavGroupNode, type NavNode } from '../../../content/navigation';
import { REDUCED_MOTION_QUERY } from '../../../hooks/useDevice';
import { getLocaleFromPathname, localizePath, stripLocale } from '../../../i18n/locale';
import { LanguageSwitch } from './LanguageSwitch';
import styles from './MobileMenu.module.css';

type MobileMenuProps = {
  id: string;
  isOpen: boolean;
  onNavigate: () => void;
  /** Menü ekranı kapladığı sürece true olur, kapanış animasyonu bitince false döner. */
  onCoverChange: (isCovering: boolean) => void;
};

type NavListProps = { nodes: NavNode[]; level: number; onNavigate: () => void };

/** Menü listesi. Açılır gruplar yerinde genişler (akordeon), aynı seviyede tek grup açık kalır. */
function NavList({ nodes, level, onNavigate }: NavListProps) {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const locale = getLocaleFromPathname(pathname);
  const [openId, setOpenId] = useState<string | null>(null);
  const isTop = level === 0;

  // Üst seviyedeki satırlar menü açılırken alttan kayarak gelir.
  const renderLabel = (label: string) =>
    isTop ? (
      <span className={styles.reveal} data-menu-reveal>
        {label}
      </span>
    ) : (
      <span>{label}</span>
    );

  return (
    <ul className={isTop ? styles.list : styles.subList} data-level={level}>
      {nodes.map((node, index) =>
        node.kind === 'link' ? (
          <li key={`${node.id}-${index}`} className={styles.item}>
            <NavLink
              className={({ isActive }) => `${styles.link} ${isActive ? styles.active : ''}`}
              to={localizePath(node.path, locale)}
              onClick={onNavigate}
            >
              {renderLabel(t(node.labelKey))}
            </NavLink>
          </li>
        ) : (
          <NavGroup
            key={node.id}
            node={node}
            level={level}
            isOpen={openId === node.id}
            onToggle={() => setOpenId((current) => (current === node.id ? null : node.id))}
            onNavigate={onNavigate}
            label={renderLabel(t(node.labelKey))}
          />
        ),
      )}
    </ul>
  );
}

type NavGroupProps = {
  node: NavGroupNode;
  level: number;
  isOpen: boolean;
  onToggle: () => void;
  onNavigate: () => void;
  label: ReactNode;
};

function NavGroup({ node, level, isOpen, onToggle, onNavigate, label }: NavGroupProps) {
  const route = stripLocale(useLocation().pathname);
  const listId = useId();
  const isActive = groupContainsPath(node, route);

  return (
    <li className={styles.item}>
      <button
        type="button"
        className={`${styles.link} ${styles.groupButton} ${isActive ? styles.active : ''}`}
        aria-expanded={isOpen}
        aria-controls={listId}
        onClick={onToggle}
      >
        {label}
        <span className={styles.toggleIcon} data-open={isOpen} aria-hidden="true" />
      </button>
      <div id={listId} className={styles.subWrap} hidden={!isOpen}>
        <NavList nodes={node.children} level={level + 1} onNavigate={onNavigate} />
      </div>
    </li>
  );
}

export function MobileMenu({ id, isOpen, onNavigate, onCoverChange }: MobileMenuProps) {
  const { t } = useTranslation();
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
    <div id={id} ref={rootRef} className={styles.menu} data-surface="light" data-tone="white" data-lenis-prevent>
      <nav aria-label={t('nav.label')}>
        <NavList nodes={HEADER_NAV} level={0} onNavigate={onNavigate} />
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
