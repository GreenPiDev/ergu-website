import { handleApiRequest } from '../server/api.js';

// Sitenin galeri sayfası için herkese açık fotoğraf listesi: `GET /api/gallery` (`server/gallery.ts`).
export default {
  fetch(request: Request): Promise<Response> {
    return handleApiRequest(request);
  },
};
