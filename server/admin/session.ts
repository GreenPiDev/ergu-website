import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Oturum, HMAC ile imzalı ve HttpOnly bir çerezde durur: `base64url(veri).base64url(imza)`. Sunucuda saklanan
 * durum yoktur. Çerez yalnızca `/api/admin` isteklerine gider, JavaScript tarafından okunamaz.
 */
export const SESSION_COOKIE = 'ergu_admin_session';
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 12;
const COOKIE_PATH = '/api/admin';

export type Session = {
  email: string;
  /** Bitiş zamanı, Unix saniyesi. */
  exp: number;
};

function sign(value: string, secret: string): string {
  return createHmac('sha256', secret).update(value).digest('base64url');
}

export function createSessionToken(email: string, secret: string): string {
  const session: Session = {
    email,
    exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SECONDS,
  };
  const payload = Buffer.from(JSON.stringify(session)).toString('base64url');
  return `${payload}.${sign(payload, secret)}`;
}

function isSession(value: unknown): value is Session {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  return typeof record.email === 'string' && typeof record.exp === 'number';
}

export function readSessionToken(token: string, secret: string): Session | null {
  const [payload, signature, ...rest] = token.split('.');
  if (!payload || !signature || rest.length > 0) return null;

  const expected = Buffer.from(sign(payload, secret));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;

  try {
    const session: unknown = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!isSession(session) || session.exp <= Date.now() / 1000) return null;
    return session;
  } catch {
    return null;
  }
}

export function getCookie(request: Request, name: string): string | null {
  const header = request.headers.get('cookie');
  if (!header) return null;
  for (const part of header.split(';')) {
    const [key, ...value] = part.trim().split('=');
    if (key === name) return value.join('=');
  }
  return null;
}

/** `Secure` yalnızca HTTPS'te eklenir: yerel ağdan (telefon, http) geliştirme sırasında da çerez çalışsın. */
function cookieAttributes(request: Request, maxAge: number): string {
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  return `Path=${COOKIE_PATH}; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure}`;
}

export function sessionCookie(request: Request, token: string): string {
  return `${SESSION_COOKIE}=${token}; ${cookieAttributes(request, SESSION_MAX_AGE_SECONDS)}`;
}

export function clearedSessionCookie(request: Request): string {
  return `${SESSION_COOKIE}=; ${cookieAttributes(request, 0)}`;
}
