import { useTranslation } from 'react-i18next';
import { Link, useLocation } from 'react-router';
import { getLocaleFromPathname, localizePath, stripLocale } from '../../../i18n/locale';
import styles from './LanguageSwitch.module.css';

function GlobeIcon() {
  return (
    <svg className={styles.icon} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9.25" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M2.75 12h18.5M12 2.75c2.6 2.5 3.9 5.6 3.9 9.25S14.6 18.75 12 21.25C9.4 18.75 8.1 15.65 8.1 12S9.4 5.25 12 2.75Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function LanguageSwitch() {
  const { t } = useTranslation();
  const { pathname, search, hash } = useLocation();
  const targetLocale = getLocaleFromPathname(pathname) === 'tr' ? 'en' : 'tr';

  return (
    <Link
      className={styles.switch}
      to={{ pathname: localizePath(stripLocale(pathname), targetLocale), search, hash }}
      hrefLang={targetLocale}
      aria-label={t('language.switch')}
    >
      <GlobeIcon />
      <span>{t('language.target')}</span>
    </Link>
  );
}
