import { handleApiRequest } from '../server/api.js';

// Sitenin sertifikalar sayfası için herkese açık liste (`GET /api/certificates`) ve görsel dosyaları
// (`GET /api/certificates/images/*`, `vercel.json` buraya yönlendirir). Mantık `server/imageCollection.ts` içindedir.
export default {
  fetch(request: Request): Promise<Response> {
    return handleApiRequest(request);
  },
};
