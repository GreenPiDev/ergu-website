import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, NavLink, useLocation } from 'react-router';
import { MAIN_CONTENT_ID, NAV_ITEMS } from '../../../content/navigation';
import { useDevice, useIsNavCollapsed } from '../../../hooks/useDevice';
import { useHeaderSurface } from '../../../hooks/useHeaderSurface';
import { useScrollLock } from '../../../hooks/useSmoothScroll';
import { getLocaleFromPathname, localizePath } from '../../../i18n/locale';
import styles from './Header.module.css';
import { LanguageSwitch } from './LanguageSwitch';
import { MobileMenu } from './MobileMenu';

const MOBILE_MENU_ID = 'mobile-menu';
const LOGO_FOR_DARK = '/sirket-logosu-dark.png';
const LOGO_FOR_LIGHT = '/sirket-logosu.png';

export function Header() {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const locale = getLocaleFromPathname(pathname);
  const device = useDevice();
  const isNavCollapsed = useIsNavCollapsed();

  const headerRef = useRef<HTMLElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const sectionSurface = useHeaderSurface(headerRef);

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isMenuCovering, setIsMenuCovering] = useState(false);
  const [previousPathname, setPreviousPathname] = useState(pathname);

  // Sayfa değişince veya geniş düzene geçilince menü render sırasında kapanır.
  if (pathname !== previousPathname) {
    setPreviousPathname(pathname);
    setIsMenuOpen(false);
  }
  if (isMenuOpen && !isNavCollapsed) setIsMenuOpen(false);

  useScrollLock(isMenuOpen);

  useEffect(() => {
    if (!isMenuOpen) return;

    const main = document.getElementById(MAIN_CONTENT_ID);
    main?.setAttribute('inert', '');

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setIsMenuOpen(false);
      toggleRef.current?.focus();
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      main?.removeAttribute('inert');
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isMenuOpen]);

  const closeMenu = () => setIsMenuOpen(false);

  return (
    <header
      ref={headerRef}
      className={styles.header}
      data-surface={isMenuOpen || isMenuCovering ? 'dark' : sectionSurface}
      data-device={device}
    >
      <div className={styles.bar}>
        <Link
          className={styles.logo}
          to={localizePath('/', locale)}
          aria-label={t('a11y.homeLink')}
          onClick={closeMenu}
        >
          <img className={`${styles.logoImage} ${styles.logoForDark}`} src={LOGO_FOR_DARK} width={300} height={108} alt="" />
          <img className={`${styles.logoImage} ${styles.logoForLight}`} src={LOGO_FOR_LIGHT} width={300} height={108} alt="" />
        </Link>

        {isNavCollapsed ? (
          <button
            ref={toggleRef}
            type="button"
            className={styles.toggle}
            data-open={isMenuOpen}
            aria-expanded={isMenuOpen}
            aria-controls={MOBILE_MENU_ID}
            aria-label={t(isMenuOpen ? 'a11y.closeMenu' : 'a11y.openMenu')}
            onClick={() => setIsMenuOpen((open) => !open)}
          >
            <span className={styles.toggleLine} />
            <span className={styles.toggleLine} />
          </button>
        ) : (
          <nav className={styles.nav} aria-label={t('nav.label')}>
            <ul className={styles.navList}>
              {NAV_ITEMS.map(({ key, path }) => {
                const label = t(`nav.items.${key}`);
                return (
                  <li key={key}>
                    <NavLink
                      className={({ isActive }) => `${styles.link} ${isActive ? styles.active : ''}`}
                      to={localizePath(path, locale)}
                      end={path === '/'}
                    >
                      <span className={styles.roll}>
                        <span>{label}</span>
                        <span aria-hidden="true">{label}</span>
                      </span>
                    </NavLink>
                  </li>
                );
              })}
            </ul>
            <LanguageSwitch />
          </nav>
        )}
      </div>

      {isNavCollapsed && (
        <MobileMenu
          id={MOBILE_MENU_ID}
          isOpen={isMenuOpen}
          onNavigate={closeMenu}
          onCoverChange={setIsMenuCovering}
        />
      )}
    </header>
  );
}
