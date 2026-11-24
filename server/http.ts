/**
 * API yanıt yardımcıları. Hata gövdeleri `{ error: <kod> }` biçimindedir, kullanıcıya gösterilen metinler arayüzün
 * çeviri dosyalarındadır.
 */
export type ApiErrorCode =
  | 'invalid_credentials'
  | 'invalid_request'
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'method_not_allowed'
  | 'not_configured'
  | 'storage_not_configured'
  | 'upload_incomplete'
  | 'conflict'
  | 'server_error';

const NO_STORE = { 'Cache-Control': 'no-store' };

export function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return Response.json(body, { status, headers: { ...NO_STORE, ...headers } });
}

export function apiError(code: ApiErrorCode, status: number, headers: Record<string, string> = {}): Response {
  return json({ error: code }, status, headers);
}

export function methodNotAllowed(allowed: string[]): Response {
  return apiError('method_not_allowed', 405, { Allow: allowed.join(', ') });
}

/** JSON gövdesini okur. Gövde JSON değilse veya çözülemezse `undefined` döner. */
export async function readJsonBody(request: Request): Promise<unknown> {
  if (!request.headers.get('content-type')?.includes('application/json')) return undefined;
  try {
    return (await request.json()) as unknown;
  } catch {
    return undefined;
  }
}
