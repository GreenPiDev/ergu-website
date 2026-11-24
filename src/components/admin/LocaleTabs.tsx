import { type KeyboardEvent, type ReactNode, useRef } from 'react';
import { LOCALES, type Locale } from '../../i18n/locale';
import styles from './LocaleTabs.module.css';

type LocaleTabsProps = {
  /** Sekme grubunun erişilebilir adı. */
  label: string;
  idPrefix: string;
  active: Locale;
  onChange: (locale: Locale) => void;
  tabLabel: (locale: Locale) => string;
  /** Hatalı alan içeren sekmeler işaretlenir, ekran okuyucuya `errorHint` okunur. */
  hasError?: (locale: Locale) => boolean;
  errorHint: string;
  renderPanel: (locale: Locale) => ReactNode;
};

/**
 * İki dilde girilen içerik için sekmeler (WAI-ARIA tabs deseni: oklar, Home/End). Panellerin hepsi bağlı kalır,
 * yalnızca görünürlükleri değişir: form değerleri sekme değişince kaybolmaz.
 */
export function LocaleTabs({
  label,
  idPrefix,
  active,
  onChange,
  tabLabel,
  hasError,
  errorHint,
  renderPanel,
}: LocaleTabsProps) {
  const tabRefs = useRef(new Map<Locale, HTMLButtonElement>());

  const focusTab = (index: number) => {
    const locale = LOCALES[(index + LOCALES.length) % LOCALES.length];
    onChange(locale);
    tabRefs.current.get(locale)?.focus();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const moves: Record<string, number> = {
      ArrowRight: index + 1,
      ArrowLeft: index - 1,
      Home: 0,
      End: LOCALES.length - 1,
    };
    if (!(event.key in moves)) return;
    event.preventDefault();
    focusTab(moves[event.key]);
  };

  return (
    <div className={styles.root}>
      <div className={styles.tabList} role="tablist" aria-label={label}>
        {LOCALES.map((locale, index) => {
          const isActive = locale === active;
          const isInvalid = hasError?.(locale) ?? false;
          return (
            <button
              key={locale}
              ref={(element) => {
                if (element) tabRefs.current.set(locale, element);
                else tabRefs.current.delete(locale);
              }}
              id={`${idPrefix}-tab-${locale}`}
              className={styles.tab}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-controls={`${idPrefix}-panel-${locale}`}
              tabIndex={isActive ? 0 : -1}
              onClick={() => onChange(locale)}
              onKeyDown={(event) => handleKeyDown(event, index)}
            >
              <span className={styles.code} aria-hidden="true">
                {locale.toLocaleUpperCase(locale)}
              </span>
              {tabLabel(locale)}
              {isInvalid && (
                <>
                  <span className={styles.errorDot} aria-hidden="true" />
                  <span className={styles.visuallyHidden}>{errorHint}</span>
                </>
              )}
            </button>
          );
        })}
      </div>

      {LOCALES.map((locale) => (
        <div
          key={locale}
          id={`${idPrefix}-panel-${locale}`}
          className={styles.panel}
          role="tabpanel"
          aria-labelledby={`${idPrefix}-tab-${locale}`}
          hidden={locale !== active}
        >
          {renderPanel(locale)}
        </div>
      ))}
    </div>
  );
}
