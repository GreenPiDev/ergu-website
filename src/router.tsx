import { createBrowserRouter, Navigate, type RouteObject } from 'react-router';
import { RootLayout } from './components/layout/RootLayout';
import { getNavPath, NAV_ITEMS } from './content/navigation';
import { localizePath } from './i18n/locale';
import { HomePage } from './pages/HomePage';
import { SectionPage } from './pages/SectionPage';

async function loadKnowledgePage() {
  const { KnowledgePage } = await import('./pages/KnowledgePage');
  return { Component: KnowledgePage };
}

// Ana sayfa 3D şehir hero'sudur, henüz yazılmamış sayfalar başlıklı hero ve test bölümlerini gösterir.
const pageRoutes: RouteObject[] = NAV_ITEMS.map(({ key, path }) => {
  if (key === 'home') return { path: path.slice(1), element: <HomePage /> };
  if (key === 'knowledgeCenter') return { path: path.slice(1), lazy: loadKnowledgePage };
  return { path: path.slice(1), element: <SectionPage navKey={key} /> };
});

// Taslak dönemi: kök adres ana sayfaya (`/home`) yönlenir. Gerçek ana sayfa yazılınca kökte durur.
const HOME_PATH = getNavPath('home');

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
