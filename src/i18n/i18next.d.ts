import 'i18next';
import type common from '../locales/tr/common.json';
import type contact from '../locales/tr/contact.json';
import type knowledge from '../locales/tr/knowledge.json';

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'common';
    resources: {
      common: typeof common;
      contact: typeof contact;
      knowledge: typeof knowledge;
    };
  }
}
