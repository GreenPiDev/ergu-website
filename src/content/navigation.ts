/**
 * Yollar dilden bağımsızdır ve her zaman İngilizcedir. Etiketler `nav.items.<key>` çevirisinden gelir.
 * Taslak dönemi: ana sayfa `/home` altındadır, kök (`/`) oraya yönlenir. Diğer sayfalar stil örneği olarak
 * `sample-` önekiyle durur, gerçek sayfalar yazılınca kaldırılır.
 */
export const NAV_ITEMS = [
  { key: 'home', path: '/home' },
  { key: 'about', path: '/sample-about' },
  { key: 'services', path: '/sample-services' },
  { key: 'projects', path: '/sample-projects' },
  { key: 'contact', path: '/sample-contact' },
  { key: 'knowledgeCenter', path: '/sample-knowledge-center' },
] as const;

export type NavKey = (typeof NAV_ITEMS)[number]['key'];

/** Menüdeki bir sayfanın dilden bağımsız yolu. */
export function getNavPath(key: NavKey): string {
  const item = NAV_ITEMS.find((navItem) => navItem.key === key);
  if (!item) throw new Error(`Bilinmeyen menü anahtarı: ${key}`);
  return item.path;
}

export const MAIN_CONTENT_ID = 'main';
