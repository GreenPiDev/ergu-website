/** Yollar dilden bağımsızdır ve her zaman İngilizcedir. Etiketler `nav.items.<key>` çevirisinden gelir. */
export const NAV_ITEMS = [
  { key: 'home', path: '/' },
  { key: 'about', path: '/about' },
  { key: 'services', path: '/services' },
  { key: 'projects', path: '/projects' },
  { key: 'contact', path: '/contact' },
  { key: 'knowledgeCenter', path: '/knowledge-center' },
] as const;

export const MAIN_CONTENT_ID = 'main';
