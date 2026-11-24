import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation } from 'react-router';
import { ContactCardIcon } from '../../contact/ContactCardIcon';
import { COMPANY, toEmailHref, toPhoneHref } from '../../../content/company';
import { HOME_PATH, MAIN_CONTENT_ID } from '../../../content/navigation';
import { useDevice, useIsNavCollapsed } from '../../../hooks/useDevice';
import { useHeaderSurface } from '../../../hooks/useHeaderSurface';
import { useScrollLock } from '../../../hooks/useSmoothScroll';
import { getLocaleFromPathname, localizePath } from '../../../i18n/locale';
import styles from './Header.module.css';
import { DesktopNav } from './DesktopNav';
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
      data-surface={isMenuOpen || isMenuCovering ? 'light' : sectionSurface}
      data-device={device}
    >
      <div className={styles.bar}>
        <Link
          className={styles.logo}
          to={localizePath(HOME_PATH, locale)}
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
          <DesktopNav />
        )}
      </div>

      {/* Ana e-posta ve telefon, bandın altında sağda. Menü açıkken menünün kendi içeriği öne çıksın diye gizlenir. */}
      <address className={styles.contact} hidden={isMenuOpen || isMenuCovering}>
        <a className={styles.contactLink} href={toEmailHref(COMPANY.emails[0])}>
          <ContactCardIcon kind="email" className={styles.contactIcon} weight="bold" />
          {COMPANY.emails[0]}
        </a>
        <a className={styles.contactLink} href={toPhoneHref(COMPANY.phones[0])}>
          <ContactCardIcon kind="phone" className={styles.contactIcon} weight="bold" />
          {COMPANY.phones[0]}
        </a>
      </address>

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
