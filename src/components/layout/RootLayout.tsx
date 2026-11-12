import { useEffect, useLayoutEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Outlet, useLocation } from 'react-router';
import { MAIN_CONTENT_ID } from '../../content/navigation';
import { getLocaleFromPathname } from '../../i18n/locale';
import { SmoothScrollProvider } from '../../providers/SmoothScrollProvider';
import { CustomCursor } from '../ui/CustomCursor/CustomCursor';
import { Header } from './Header/Header';
import { PageTransition } from './PageTransition/PageTransition';
import styles from './RootLayout.module.css';

export function RootLayout() {
  const { t, i18n } = useTranslation();
  const locale = getLocaleFromPathname(useLocation().pathname);

  // Dilin tek doğruluk kaynağı URL'dir.
  useLayoutEffect(() => {
    void i18n.changeLanguage(locale);
    document.documentElement.lang = locale;
  }, [i18n, locale]);

  useEffect(() => {
    document.title = t('meta.title');
  }, [t]);

  return (
    <SmoothScrollProvider>
      <a className={styles.skipLink} href={`#${MAIN_CONTENT_ID}`}>
        {t('a11y.skipToContent')}
      </a>
      <Header />
      <main id={MAIN_CONTENT_ID} tabIndex={-1}>
        <Outlet />
      </main>
      <CustomCursor />
      <PageTransition />
    </SmoothScrollProvider>
  );
}
