import { apiError as error, json, methodNotAllowed, readJsonBody } from '../http.js';
import { AdminConfigError, readAdminConfig, type AdminConfig } from './config.js';
import { COLLECTIONS } from '../imageCollection.js';
import { handleAdminCollection } from './collection.js';
import { verifyPassword } from './password.js';
import {
  clearedSessionCookie,
  createSessionToken,
  getCookie,
  readSessionToken,
  SESSION_COOKIE,
  sessionCookie,
  type Session,
} from './session.js';

/**
 * Yönetim paneli API'si. Tüm `/api/admin/*` istekleri buraya gelir, yol adına göre yönlendirilir.
 *
 * - `POST /api/admin/login`   { email, password } → oturum çerezi
 * - `POST /api/admin/logout`  → çerez silinir
 * - `GET  /api/admin/session` → oturum açıksa kullanıcı, değilse 401
 * - `/api/admin/gallery/*`, `/api/admin/certificates/*` → görsel koleksiyonları (`collection.ts`), oturum gerekir
 */
const BASE_PATH = '/api/admin';
// Hatalı girişte yanıt geciktirilir: deneme yanılma yavaşlar, doğru ve yanlış e-posta aynı sürede döner.
const FAILED_LOGIN_DELAY_MS = 600;
const MAX_FIELD_LENGTH = 256;
const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Çerez `SameSite=Strict` olsa da, durum değiştiren isteklerde başka siteden gelen istekler ayrıca reddedilir.
 * Tarayıcı `Origin` başlığını gönderirse isteğin geldiği adresle aynı olmalıdır.
 */
function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return true;
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host');
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

function currentSession(request: Request, config: AdminConfig): Session | null {
  const token = getCookie(request, SESSION_COOKIE);
  if (!token) return null;
  const session = readSessionToken(token, config.sessionSecret);
  // Ortamdaki e-posta değişirse eski oturumlar geçersiz olur.
  return session && session.email === config.email ? session : null;
}

async function readCredentials(request: Request): Promise<{ email: string; password: string } | null> {
  const body = await readJsonBody(request);
  if (typeof body !== 'object' || body === null) return null;
  const { email, password } = body as Record<string, unknown>;
  if (typeof email !== 'string' || typeof password !== 'string') return null;
  if (email.length > MAX_FIELD_LENGTH || password.length > MAX_FIELD_LENGTH) return null;
  return { email: email.trim().toLowerCase(), password };
}

async function login(request: Request, config: AdminConfig): Promise<Response> {
  const credentials = await readCredentials(request);
  if (!credentials) return error('invalid_request', 400);

  // Şifre her durumda doğrulanır: e-postanın doğru olup olmadığı yanıt süresinden anlaşılmasın.
  const isPasswordValid = await verifyPassword(credentials.password, config.passwordHash);
  if (!isPasswordValid || credentials.email !== config.email) {
    await wait(FAILED_LOGIN_DELAY_MS);
    return error('invalid_credentials', 401);
  }

  const token = createSessionToken(config.email, config.sessionSecret);
  return json({ user: { email: config.email } }, 200, {
    'Set-Cookie': sessionCookie(request, token),
  });
}

export async function handleAdminRequest(request: Request): Promise<Response> {
  const route = new URL(request.url).pathname.replace(/\/+$/, '');
  const method = request.method.toUpperCase();

  let config: AdminConfig;
  try {
    config = readAdminConfig();
  } catch (cause) {
    if (cause instanceof AdminConfigError) return error('not_configured', 500);
    throw cause;
  }

  if (UNSAFE_METHODS.has(method) && !isSameOrigin(request)) return error('forbidden', 403);

  const collection = COLLECTIONS.find(({ name }) => {
    const path = `${BASE_PATH}/${name}`;
    return route === path || route.startsWith(`${path}/`);
  });
  if (collection) {
    if (!currentSession(request, config)) return error('unauthorized', 401);
    return handleAdminCollection(request, collection, method, route.slice(`${BASE_PATH}/${collection.name}`.length));
  }

  switch (route) {
    case `${BASE_PATH}/login`:
      return method === 'POST' ? login(request, config) : methodNotAllowed(['POST']);

    case `${BASE_PATH}/logout`:
      if (method !== 'POST') return methodNotAllowed(['POST']);
      return json({ ok: true }, 200, {
        'Set-Cookie': clearedSessionCookie(request),
      });

    case `${BASE_PATH}/session`: {
      if (method !== 'GET') return methodNotAllowed(['GET']);
      const session = currentSession(request, config);
      return session ? json({ user: { email: session.email } }) : error('unauthorized', 401);
    }

    default:
      return error('not_found', 404);
  }
}
