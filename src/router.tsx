import { createBrowserRouter, Navigate, type RouteObject } from 'react-router';
import { RootLayout } from './components/layout/RootLayout';
import { NAV_ITEMS } from './content/navigation';
import { HomePage } from './pages/HomePage';
import { SectionPage } from './pages/SectionPage';

async function loadKnowledgePage() {
  const { KnowledgePage } = await import('./pages/KnowledgePage');
  return { Component: KnowledgePage };
}

// Ana sayfa 3D şehir hero'sudur, henüz yazılmamış sayfalar başlıklı hero ve test bölümlerini gösterir.
const pageRoutes: RouteObject[] = NAV_ITEMS.map(({ key, path }) => {
  if (path === '/') return { index: true, element: <HomePage /> };
  if (path === '/knowledge-center') return { path: path.slice(1), lazy: loadKnowledgePage };
  return { path: path.slice(1), element: <SectionPage navKey={key} /> };
});

// Header tek layout'ta durur, dil değişse de yeniden oluşturulmaz.
export const router = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />,
    // Doğrudan lazy bir sayfadan açılışta paket inene kadar html zemini görünür.
    hydrateFallbackElement: <></>,
    children: [
      ...pageRoutes,
      { path: 'en', children: pageRoutes },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]);
