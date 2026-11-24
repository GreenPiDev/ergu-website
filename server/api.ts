import { handleAdminRequest } from './admin/handler.js';
import { apiError } from './http.js';
import { findFileCollection, findListCollection, handleImageFile, handlePublicList } from './imageCollection.js';

/**
 * Tüm API isteklerinin ortak girişi. Vercel'de `api/*.ts` dosyaları, geliştirme sunucusunda Vite eklentisi
 * (`server/vite-api.ts`) buraya bağlanır. Beklenmeyen hatalar ayrıntı sızdırmadan 500 döner.
 */
export const API_PREFIXES = ['/api/admin', '/api/gallery', '/api/certificates'] as const;

export async function handleApiRequest(request: Request): Promise<Response> {
  const pathname = new URL(request.url).pathname.replace(/\/+$/, '');
  try {
    const listCollection = findListCollection(pathname);
    if (listCollection) return await handlePublicList(request, listCollection);
    const fileCollection = findFileCollection(pathname);
    if (fileCollection) return await handleImageFile(request, fileCollection, pathname);
    if (pathname === '/api/admin' || pathname.startsWith('/api/admin/')) return await handleAdminRequest(request);
    return apiError('not_found', 404);
  } catch (cause) {
    console.error(cause);
    return apiError('server_error', 500);
  }
}
