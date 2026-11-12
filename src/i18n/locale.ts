export type Locale = 'tr' | 'en';

export const DEFAULT_LOCALE: Locale = 'tr';

const EN_PREFIX = '/en';

function hasEnPrefix(pathname: string): boolean {
  return pathname === EN_PREFIX || pathname.startsWith(`${EN_PREFIX}/`);
}

export function getLocaleFromPathname(pathname: string): Locale {
  return hasEnPrefix(pathname) ? 'en' : DEFAULT_LOCALE;
}

/** Yoldaki dil önekini kaldırır: `/en/about` → `/about`. */
export function stripLocale(pathname: string): string {
  return hasEnPrefix(pathname) ? pathname.slice(EN_PREFIX.length) || '/' : pathname;
}

/** Dilden bağımsız yolu verilen dile çevirir: `/about` → `/en/about`. */
export function localizePath(path: string, locale: Locale): string {
  if (locale === DEFAULT_LOCALE) return path;
  return path === '/' ? EN_PREFIX : `${EN_PREFIX}${path}`;
}
