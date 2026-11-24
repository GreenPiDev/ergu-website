import { createBrowserRouter, Navigate, type RouteObject } from 'react-router';
import { RootLayout } from './components/layout/RootLayout';
import { ADMIN_BASE_PATH, ADMIN_CERTIFICATES_PATH, ADMIN_GALLERY_PATH } from './content/adminNavigation';
import { CERTIFICATES_PATH, CONTACT_PATH, GALLERY_PATH, HOME_PATH, NAV_PAGES, SAMPLE_PAGES } from './content/navigation';
import { localizePath } from './i18n/locale';
import { HomePage } from './pages/HomePage';
import { PlaceholderPage } from './pages/PlaceholderPage';
import { SectionPage } from './pages/SectionPage';

async function loadKnowledgePage() {
  const { KnowledgePage } = await import('./pages/KnowledgePage');
  return { Component: KnowledgePage };
}

async function loadContactPage() {
  const { ContactPage } = await import('./pages/ContactPage');
  return { Component: ContactPage };
}

// Yönetim paneli sitenin paketine girmez, yalnızca panel adresi açılınca yüklenir.
async function loadAdminRoot() {
  const { AdminRoot } = await import('./components/admin/AdminRoot');
  return { Component: AdminRoot };
}

async function loadAdminOverviewPage() {
  const { AdminOverviewPage } = await import('./pages/admin/AdminOverviewPage');
  return { Component: AdminOverviewPage };
}

async function loadAdminGalleryPage() {
  const { AdminGalleryPage } = await import('./pages/admin/AdminCollectionPage');
  return { Component: AdminGalleryPage };
}

async function loadAdminCertificatesPage() {
  const { AdminCertificatesPage } = await import('./pages/admin/AdminCollectionPage');
  return { Component: AdminCertificatesPage };
}

// Panelin sayfaları (`/admin-panel/...`). Menüsü `src/content/adminNavigation.ts` içindedir.
const adminRoutes: RouteObject[] = [
  { index: true, lazy: loadAdminOverviewPage },
  { path: ADMIN_GALLERY_PATH.slice(ADMIN_BASE_PATH.length + 1), lazy: loadAdminGalleryPage },
  { path: ADMIN_CERTIFICATES_PATH.slice(ADMIN_BASE_PATH.length + 1), lazy: loadAdminCertificatesPage },
  { path: '*', element: <Navigate to={ADMIN_BASE_PATH} replace /> },
];

async function loadGalleryPage() {
  const { GalleryPage } = await import('./pages/GalleryPage');
  return { Component: GalleryPage };
}

async function loadCertificatesPage() {
  const { CertificatesPage } = await import('./pages/CertificatesPage');
  return { Component: CertificatesPage };
}

// Ana sayfa 3D şehir hero'sudur. Örnek sayfalar başlıklı hero ve test bölümlerini, asıl menüde içeriği henüz
// yazılmamış sayfalar yer tutucu gösterir. Taslak dönemi: kök adres ana sayfaya (`/home`) yönlenir.
const pageRoutes: RouteObject[] = NAV_PAGES.map(({ path, labelKey }) => {
  const routePath = path.slice(1);
  if (path === HOME_PATH) return { path: routePath, element: <HomePage /> };
  if (path === CONTACT_PATH) return { path: routePath, lazy: loadContactPage };
  if (path === GALLERY_PATH) return { path: routePath, lazy: loadGalleryPage };
  if (path === CERTIFICATES_PATH) return { path: routePath, lazy: loadCertificatesPage };
  const sample = SAMPLE_PAGES.find((page) => page.path === path);
  if (sample?.key === 'knowledgeCenter') return { path: routePath, lazy: loadKnowledgePage };
  if (sample) return { path: routePath, element: <SectionPage navKey={sample.key} /> };
  return { path: routePath, element: <PlaceholderPage labelKey={labelKey} /> };
});

// Header tek layout'ta durur, dil değişse de yeniden oluşturulmaz.
export const router = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />,
    // Doğrudan lazy bir sayfadan açılışta paket inene kadar html zemini görünür.
    hydrateFallbackElement: <></>,
    children: [
      { index: true, element: <Navigate to={localizePath(HOME_PATH, 'tr')} replace /> },
      ...pageRoutes,
      {
        path: 'en',
        children: [{ index: true, element: <Navigate to={localizePath(HOME_PATH, 'en')} replace /> }, ...pageRoutes],
      },
      { path: '*', element: <Navigate to={HOME_PATH} replace /> },
    ],
  },
  // Site layout'unun (header, perde, smooth scroll) dışındadır, dil öneki yoktur.
  {
    path: ADMIN_BASE_PATH,
    lazy: loadAdminRoot,
    hydrateFallbackElement: <></>,
    children: adminRoutes,
  },
]);
