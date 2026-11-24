/**
 * Yönetim panelinin yolları ve menüsü. Panel sitenin arayüzünden bağlantı almaz, yalnızca adresle açılır.
 * Yollar İngilizcedir (ör. `/admin-panel/gallery`), etiketler `admin` çevirisinin `nav.*` anahtarlarından gelir.
 * Yeni bir bölüm eklenince menüye buradan, rotası `src/router.tsx` içindeki `adminRoutes` listesine eklenir.
 */
import type admin from '../locales/tr/admin.json';

type AdminNavId = Exclude<keyof typeof admin.nav, 'label'>;

export type AdminNavItem = {
  id: AdminNavId;
  labelKey: `nav.${AdminNavId}`;
  path: string;
};

export const ADMIN_BASE_PATH = '/admin-panel';
export const ADMIN_MAIN_ID = 'admin-main';

export const ADMIN_GALLERY_PATH = `${ADMIN_BASE_PATH}/gallery`;

export const ADMIN_NAV: AdminNavItem[] = [
  { id: 'overview', labelKey: 'nav.overview', path: ADMIN_BASE_PATH },
  { id: 'gallery', labelKey: 'nav.gallery', path: ADMIN_GALLERY_PATH },
];
