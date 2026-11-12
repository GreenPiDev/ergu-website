import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import enCommon from '../locales/en/common.json';
import trCommon from '../locales/tr/common.json';
import { DEFAULT_LOCALE, getLocaleFromPathname } from './locale';

void i18n.use(initReactI18next).init({
  resources: {
    tr: { common: trCommon },
    en: { common: enCommon },
  },
  // İlk karede doğru dilin görünmesi için dil doğrudan URL'den okunur.
  lng: getLocaleFromPathname(window.location.pathname),
  fallbackLng: DEFAULT_LOCALE,
  defaultNS: 'common',
  initAsync: false,
  interpolation: { escapeValue: false },
});

export default i18n;
