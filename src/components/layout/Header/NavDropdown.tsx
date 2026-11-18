import { useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { NavLink, useLocation } from 'react-router';
import { NAV_ITEMS } from '../../../content/navigation';
import { getLocaleFromPathname, localizePath } from '../../../i18n/locale';
import headerStyles from './Header.module.css';
import styles from './NavDropdown.module.css';

// Taslak dönemi: masaüstü menüdeki bütün bağlantılar tek bir açılır düğmenin altında durur.
// Bağlantı listesi olduğu için ARIA menu değil, açılıp kapanan (disclosure) desen kullanılır.
export function NavDropdown() {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const locale = getLocaleFromPathname(pathname);
  const panelId = useId();

  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [previousPathname, setPreviousPathname] = useState(pathname);

  // Sayfa değişince liste render sırasında kapanır.
  if (pathname !== previousPathname) {
    setPreviousPathname(pathname);
    setIsOpen(false);
  }

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && rootRef.current?.contains(event.target)) return;
      setIsOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setIsOpen(false);
      buttonRef.current?.focus();
    };
    // Odak listenin dışına çıkınca (Tab ile) liste kapanır.
    const handleFocusIn = (event: FocusEvent) => {
      if (event.target instanceof Node && rootRef.current?.contains(event.target)) return;
      setIsOpen(false);
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('focusin', handleFocusIn);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('focusin', handleFocusIn);
    };
  }, [isOpen]);

  const label = t('nav.allButtons');

  return (
    <div ref={rootRef} className={styles.root}>
      <button
        ref={buttonRef}
        type="button"
        className={`${headerStyles.link} ${styles.trigger}`}
        aria-expanded={isOpen}
        aria-controls={panelId}
        onClick={() => setIsOpen((open) => !open)}
      >
        <span className={headerStyles.roll}>
          <span>{label}</span>
          <span aria-hidden="true">{label}</span>
        </span>
        <span className={styles.chevron} data-open={isOpen} aria-hidden="true" />
      </button>

      <ul id={panelId} className={styles.panel} data-open={isOpen}>
        {NAV_ITEMS.map(({ key, path }) => (
          <li key={key}>
            <NavLink
              className={({ isActive }) => `${styles.item} ${isActive ? styles.active : ''}`}
              to={localizePath(path, locale)}
            >
              {t(`nav.items.${key}`)}
            </NavLink>
          </li>
        ))}
      </ul>
    </div>
  );
}
