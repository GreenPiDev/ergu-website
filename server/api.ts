import { handleAdminRequest } from './admin/handler.js';
import { handlePhotoFile, handlePublicGallery, isPhotoFilePath } from './gallery.js';
import { apiError } from './http.js';

/**
 * Tüm API isteklerinin ortak girişi. Vercel'de `api/*.ts` dosyaları, geliştirme sunucusunda Vite eklentisi
 * (`server/vite-api.ts`) buraya bağlanır. Beklenmeyen hatalar ayrıntı sızdırmadan 500 döner.
 */
export const API_PREFIXES = ['/api/admin', '/api/gallery'] as const;

export async function handleApiRequest(request: Request): Promise<Response> {
  const pathname = new URL(request.url).pathname.replace(/\/+$/, '');
  try {
    if (pathname === '/api/gallery') return await handlePublicGallery(request);
    if (isPhotoFilePath(pathname)) return await handlePhotoFile(request, pathname);
    if (pathname === '/api/admin' || pathname.startsWith('/api/admin/')) return await handleAdminRequest(request);
    return apiError('not_found', 404);
  } catch (cause) {
    console.error(cause);
    return apiError('server_error', 500);
  }
}
