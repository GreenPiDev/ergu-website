import 'i18next';
import type common from '../locales/tr/common.json';
import type knowledge from '../locales/tr/knowledge.json';

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'common';
    resources: {
      common: typeof common;
      knowledge: typeof knowledge;
    };
  }
}
