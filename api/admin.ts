import { handleApiRequest } from '../server/api.js';

// Vercel Function giriş noktası. `vercel.json` tüm `/api/admin/*` yollarını buraya yönlendirir, istek URL'si
// özgün yolu korur. Asıl mantık `server/` altındadır, geliştirme sunucusu da aynı kodu çalıştırır.
export default {
  fetch(request: Request): Promise<Response> {
    return handleApiRequest(request);
  },
};
