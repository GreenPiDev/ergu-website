import { createBrowserRouter, Navigate, type RouteObject } from 'react-router';
import { RootLayout } from './components/layout/RootLayout';
import { CONTACT_PATH, HOME_PATH, NAV_PAGES, SAMPLE_PAGES } from './content/navigation';
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

// Ana sayfa 3D şehir hero'sudur. Örnek sayfalar başlıklı hero ve test bölümlerini, asıl menüde içeriği henüz
// yazılmamış sayfalar yer tutucu gösterir. Taslak dönemi: kök adres ana sayfaya (`/home`) yönlenir.
const pageRoutes: RouteObject[] = NAV_PAGES.map(({ path, labelKey }) => {
  const routePath = path.slice(1);
  if (path === HOME_PATH) return { path: routePath, element: <HomePage /> };
  if (path === CONTACT_PATH) return { path: routePath, lazy: loadContactPage };
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
]);
