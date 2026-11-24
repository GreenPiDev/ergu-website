import { handleApiRequest } from '../server/api.js';

// Sitenin galeri sayfası için herkese açık fotoğraf listesi (`GET /api/gallery`) ve fotoğraf dosyaları
// (`GET /api/gallery/photos/*`, `vercel.json` buraya yönlendirir). Mantık `server/gallery.ts` içindedir.
export default {
  fetch(request: Request): Promise<Response> {
    return handleApiRequest(request);
  },
};
