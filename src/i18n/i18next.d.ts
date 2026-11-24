import 'i18next';
import type admin from '../locales/tr/admin.json';
import type common from '../locales/tr/common.json';
import type contact from '../locales/tr/contact.json';
import type gallery from '../locales/tr/gallery.json';
import type knowledge from '../locales/tr/knowledge.json';

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'common';
    resources: {
      admin: typeof admin;
      common: typeof common;
      contact: typeof contact;
      gallery: typeof gallery;
      knowledge: typeof knowledge;
    };
  }
}
