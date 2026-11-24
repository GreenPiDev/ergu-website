/**
 * Site menüsü ve sayfa yolları. Yollar dilden bağımsızdır ve her zaman İngilizcedir, etiketler `labelKey` çevirisinden gelir.
 * Header, mobil menü, rotalar ve sayfa geçişi perdesi buradan beslenir.
 */

import type common from '../locales/tr/common.json';

type MainId = keyof typeof common.nav.main;
export type SampleKey = keyof typeof common.nav.items;
/** Menü etiketinin çeviri anahtarı; yanlış anahtar derlemede yakalanır. */
export type NavLabelKey = `nav.main.${MainId}` | `nav.items.${SampleKey}` | 'nav.allButtons';

export type NavLinkNode = { kind: 'link'; id: string; labelKey: NavLabelKey; path: string };
export type NavGroupNode = { kind: 'group'; id: string; labelKey: NavLabelKey; children: NavNode[] };
export type NavNode = NavLinkNode | NavGroupNode;

const link = (id: MainId, path: string): NavLinkNode => ({ kind: 'link', id, labelKey: `nav.main.${id}`, path });
const group = (id: MainId, children: NavNode[]): NavGroupNode => ({
  kind: 'group',
  id,
  labelKey: `nav.main.${id}`,
  children,
});

export const HOME_PATH = '/home';
export const CONTACT_PATH = '/contact';
export const GALLERY_PATH = '/gallery';
export const CERTIFICATES_PATH = '/certificates';

/** Header'daki asıl menü. */
export const MAIN_NAV: NavNode[] = [
  link('home', HOME_PATH),
  group('corporate', [
    link('contact', CONTACT_PATH),
    link('gallery', GALLERY_PATH),
    link('certificates', CERTIFICATES_PATH),
  ]),
  group('industries', [
    link('solarPlants', '/industries/solar-power-plants'),
    link('biomassPlants', '/industries/biomass-power-plants'),
    link('industrialFacilities', '/industries/industrial-facilities'),
    link('energyDistribution', '/industries/energy-distribution'),
    link('oilGas', '/industries/oil-and-gas'),
    link('waterSystems', '/industries/water-and-wastewater'),
  ]),
  group('products', [
    link('instrumentTransformers', '/products/current-and-voltage-transformers'),
    group('lowVoltagePanels', [
      link('transformerPanel', '/products/low-voltage-panels/transformer-panel'),
      link('factoryPanel', '/products/low-voltage-panels/factory-panel'),
      link('constructionPanel', '/products/low-voltage-panels/construction-site-panel'),
    ]),
    link('evCharging', '/products/ev-charging-stations'),
    link('lightingPoles', '/products/lighting-poles'),
    link('steelKiosks', '/products/steel-kiosks'),
    link('concreteKiosks', '/products/concrete-kiosks'),
    link('prefabBuildings', '/products/prefabricated-buildings'),
    link('busbar', '/products/busbar'),
    link('gasInsulatedSwitchgear', '/products/gas-insulated-switchgear'),
    link('generators', '/products/generators'),
    link('cables', '/products/cables-and-accessories'),
    link('relayScada', '/products/relay-and-scada'),
    link('transformers', '/products/transformers'),
    link('upsRectifiers', '/products/ups-and-rectifiers'),
  ]),
  link('projects', '/projects'),
  link('eCatalog', '/e-catalog'),
  link('contact', CONTACT_PATH),
];

/**
 * Taslak dönemi: stil örneği olarak duran sayfalar, header'da "Tüm Butonlar" altında. Gerçek sayfalar yazılınca
 * bu liste, `SAMPLE_NAV` ve `SectionPage` kaldırılır.
 */
export const SAMPLE_PAGES: { key: SampleKey; path: string }[] = [
  { key: 'home', path: HOME_PATH },
  { key: 'about', path: '/sample-about' },
  { key: 'services', path: '/sample-services' },
  { key: 'projects', path: '/sample-projects' },
  { key: 'knowledgeCenter', path: '/sample-knowledge-center' },
];

export const SAMPLE_NAV: NavGroupNode = {
  kind: 'group',
  id: 'allButtons',
  labelKey: 'nav.allButtons',
  children: SAMPLE_PAGES.map(({ key, path }) => ({ kind: 'link', id: key, labelKey: `nav.items.${key}`, path })),
};

/** Header ve mobil menüde sırasıyla gösterilenler. */
export const HEADER_NAV: NavNode[] = [...MAIN_NAV, SAMPLE_NAV];

function collectLinks(nodes: NavNode[]): NavLinkNode[] {
  return nodes.flatMap((node) => (node.kind === 'link' ? [node] : collectLinks(node.children)));
}

/** Menüdeki bütün sayfalar, her yol bir kez. İlk geçen etiket kullanılır (ör. Ana Sayfa asıl menüden). */
export const NAV_PAGES: NavLinkNode[] = collectLinks(HEADER_NAV).filter(
  (page, index, list) => list.findIndex((other) => other.path === page.path) === index,
);

/** Grubun altında verilen yol (veya onun alt yolu) var mı; açılır menü başlığını aktif göstermek için. */
export function groupContainsPath(node: NavGroupNode, route: string): boolean {
  return node.children.some((child) =>
    child.kind === 'link' ? child.path === route : groupContainsPath(child, route),
  );
}

export const MAIN_CONTENT_ID = 'main';
