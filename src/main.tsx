import '@fontsource-variable/big-shoulders-stencil';
import '@fontsource-variable/geist';
import 'lenis/dist/lenis.css';
import './styles/tokens.css';
import './styles/base.css';
import './i18n';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router';
import { router } from './router';

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('#root bulunamadı.');

createRoot(rootElement).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
