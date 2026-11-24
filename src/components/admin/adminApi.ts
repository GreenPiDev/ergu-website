import { useOutletContext } from 'react-router';

/**
 * Yönetim paneli API istemcisi (`server/admin/handler.ts`). Oturum HttpOnly çerezdedir, istemci onu göremez;
 * oturumun açık olup olmadığı `/api/admin/session` ile öğrenilir.
 */
const API_BASE = '/api/admin';

export type AdminUser = { email: string };

/** Sunucunun döndürdüğü hata kodları (`server/http.ts`). Ağ hatası ve beklenmeyen yanıtlar `unknown` olur. */
const KNOWN_CODES = [
  'invalid_credentials',
  'not_configured',
  'unauthorized',
  'storage_not_configured',
  'upload_incomplete',
  'not_found',
  'conflict',
] as const;

export type AdminApiErrorCode = (typeof KNOWN_CODES)[number] | 'unknown';

export class AdminApiError extends Error {
  readonly code: AdminApiErrorCode;

  constructor(code: AdminApiErrorCode) {
    super(`Yönetim paneli isteği başarısız: ${code}`);
    this.code = code;
  }
}

export async function adminRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...init,
      credentials: 'same-origin',
      headers: { Accept: 'application/json', ...init.headers },
    });
  } catch {
    throw new AdminApiError('unknown');
  }

  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const code = (body as { error?: unknown } | null)?.error;
    throw new AdminApiError(KNOWN_CODES.find((known) => known === code) ?? 'unknown');
  }
  return body as T;
}

/** JSON gövdeli istek: POST, PATCH, DELETE. */
export function sendAdminJson<T>(method: 'POST' | 'PATCH' | 'DELETE', path: string, data?: unknown): Promise<T> {
  return adminRequest<T>(path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data ?? {}),
  });
}

/** Açık oturumun kullanıcısını döndürür, oturum yoksa `null`. */
export async function fetchAdminSession(): Promise<AdminUser | null> {
  try {
    const { user } = await adminRequest<{ user: AdminUser }>('/session');
    return user;
  } catch (error) {
    if (error instanceof AdminApiError && error.code === 'unauthorized') return null;
    throw error;
  }
}

export async function loginAdmin(email: string, password: string): Promise<AdminUser> {
  const { user } = await sendAdminJson<{ user: AdminUser }>('POST', '/login', {
    email,
    password,
  });
  return user;
}

export async function logoutAdmin(): Promise<void> {
  await sendAdminJson('POST', '/logout');
}

/** Panel sayfalarının `Outlet` üzerinden aldığı oturum bilgisi. */
export type AdminOutletContext = { user: AdminUser };

export function useAdminUser(): AdminUser {
  return useOutletContext<AdminOutletContext>().user;
}
