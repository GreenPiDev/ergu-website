import { ImagesIcon } from '@phosphor-icons/react/dist/csr/Images';
import { ArrowSquareOutIcon } from '@phosphor-icons/react/dist/csr/ArrowSquareOut';
import { SignOutIcon } from '@phosphor-icons/react/dist/csr/SignOut';
import { SquaresFourIcon } from '@phosphor-icons/react/dist/csr/SquaresFour';
import type { Icon } from '@phosphor-icons/react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, NavLink, Outlet } from 'react-router';
import { ADMIN_BASE_PATH, ADMIN_MAIN_ID, ADMIN_NAV, type AdminNavItem } from '../../content/adminNavigation';
import { HOME_PATH } from '../../content/navigation';
import type { AdminOutletContext, AdminUser } from './adminApi';
import styles from './AdminShell.module.css';

const NAV_ICONS: Record<AdminNavItem['id'], Icon> = {
  overview: SquaresFourIcon,
  gallery: ImagesIcon,
};

type AdminShellProps = {
  user: AdminUser;
  onLogout: () => Promise<void>;
};

/** Giriş yapılmış panelin iskeleti: solda menü ve hesap, sağda seçili sayfa. Dar ekranda menü üste geçer. */
export function AdminShell({ user, onLogout }: AdminShellProps) {
  const { t } = useTranslation('admin');
  const [isSigningOut, setIsSigningOut] = useState(false);
  const outletContext: AdminOutletContext = { user };

  const handleLogout = () => {
    setIsSigningOut(true);
    void onLogout();
  };

  return (
    <div className={styles.shell}>
      <a className={styles.skipLink} href={`#${ADMIN_MAIN_ID}`}>
        {t('a11y.skipToContent')}
      </a>

      <aside className={styles.sidebar} data-surface="dark">
        <Link className={styles.brand} to={ADMIN_BASE_PATH}>
          <img
            className={styles.logo}
            src="/sirket-logosu-dark.png"
            width={300}
            height={108}
            alt={t('brand.logoAlt')}
          />
          <span className={styles.brandLabel}>{t('brand.panel')}</span>
        </Link>

        <nav className={styles.nav} aria-label={t('nav.label')}>
          <ul className={styles.navList}>
            {ADMIN_NAV.map((item) => {
              const ItemIcon = NAV_ICONS[item.id];
              return (
                <li key={item.id}>
                  <NavLink className={styles.navLink} to={item.path} end={item.path === ADMIN_BASE_PATH}>
                    <ItemIcon className={styles.navIcon} aria-hidden="true" />
                    {t(item.labelKey)}
                  </NavLink>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className={styles.account}>
          <p className={styles.accountInfo}>
            <span className={styles.accountLabel}>{t('account.signedInAs')}</span>
            <span className={styles.accountEmail}>{user.email}</span>
          </p>
          <div className={styles.accountActions}>
            <a className={styles.action} href={HOME_PATH} target="_blank" rel="noopener">
              <ArrowSquareOutIcon className={styles.actionIcon} aria-hidden="true" />
              {t('account.viewSite')}
              <span className={styles.visuallyHidden}>{t('account.viewSiteHint')}</span>
            </a>
            <button className={styles.action} type="button" onClick={handleLogout} disabled={isSigningOut}>
              <SignOutIcon className={styles.actionIcon} aria-hidden="true" />
              {t('account.signOut')}
            </button>
          </div>
        </div>
      </aside>

      <main id={ADMIN_MAIN_ID} className={styles.main} tabIndex={-1}>
        <Outlet context={outletContext} />
      </main>
    </div>
  );
}
