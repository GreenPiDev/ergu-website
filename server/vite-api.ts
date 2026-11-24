import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Plugin, ViteDevServer } from 'vite';

/**
 * Geliştirme sunucusunda `/api/admin/*`, `/api/gallery` ve `/api/certificates` isteklerini Vercel Function'ların
 * kullandığı kodla karşılar (`server/api.ts`). Böylece yerelde ayrıca `vercel dev` gerekmez. Yayın derlemesine girmez.
 * Ortam değişkenleri `vite.config.ts` içinde `.env.local` dosyasından `process.env`'e aktarılır.
 */
// `server/api.ts › API_PREFIXES` ile aynı tutulur.
const API_PREFIXES = ['/api/admin', '/api/gallery', '/api/certificates'];
const HANDLER_MODULE = '/server/api.ts';

type HandlerModule = {
  handleApiRequest: (request: Request) => Promise<Response>;
};

function isApiPath(url: string): boolean {
  const pathname = url.split('?')[0];
  return API_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

async function readBody(req: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : (chunk as Buffer));
  return Buffer.concat(chunks);
}

async function toRequest(req: IncomingMessage, url: string): Promise<Request> {
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (Array.isArray(value)) value.forEach((item) => headers.append(key, item));
    else if (value !== undefined) headers.set(key, value);
  }
  const method = req.method ?? 'GET';
  const body = method === 'GET' || method === 'HEAD' ? undefined : new Uint8Array(await readBody(req));
  return new Request(new URL(url, `http://${req.headers.host ?? 'localhost'}`), { method, headers, body });
}

async function sendResponse(res: ServerResponse, response: Response): Promise<void> {
  res.statusCode = response.status;
  response.headers.forEach((value, key) => {
    if (key !== 'set-cookie') res.setHeader(key, value);
  });
  const cookies = response.headers.getSetCookie();
  if (cookies.length > 0) res.setHeader('set-cookie', cookies);
  res.end(Buffer.from(await response.arrayBuffer()));
}

export function apiDevPlugin(): Plugin {
  return {
    name: 'ergu-api-dev',
    apply: 'serve',
    configureServer(server: ViteDevServer) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url ?? '';
        if (!isApiPath(url)) return next();
        try {
          // Her istekte modül grafiğinden yüklenir: sunucu kodundaki değişiklikler yeniden başlatmadan geçerli olur.
          const { handleApiRequest } = (await server.ssrLoadModule(HANDLER_MODULE)) as HandlerModule;
          await sendResponse(res, await handleApiRequest(await toRequest(req, url)));
        } catch (cause) {
          next(cause);
        }
      });
    },
  };
}
