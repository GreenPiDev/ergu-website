import { AwsClient } from 'aws4fetch';

/**
 * Cloudflare R2 erişimi (S3 uyumlu API, `aws4fetch` ile imzalanır). Ayarlar ortam değişkenlerinden gelir:
 *
 * - `R2_ACCOUNT_ID`: Cloudflare hesap kimliği.
 * - `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`: yalnızca bu bucket'a "Object Read & Write" yetkili R2 API token'ı.
 * - `R2_BUCKET`: bucket adı.
 *
 * Bucket'ın herkese açık adresi (r2.dev) kullanılmaz: Türkiye'de erişim engeli var ve Cloudflare'e göre yalnızca
 * geliştirme içindir. Görseller sitenin kendi alan adından, API üzerinden aktarılır (`server/imageCollection.ts`).
 */
export type StorageConfig = {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
};

export class StorageConfigError extends Error {}

export function readStorageConfig(): StorageConfig {
  const accountId = process.env.R2_ACCOUNT_ID?.trim();
  const accessKeyId = process.env.R2_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY?.trim();
  const bucket = process.env.R2_BUCKET?.trim();

  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) {
    throw new StorageConfigError('R2 ortam değişkenleri eksik.');
  }
  return { accountId, accessKeyId, secretAccessKey, bucket };
}

export type StoredJson = { data: unknown; etag: string };
export type ObjectInfo = { size: number; contentType: string | null };

/** Koşullu yazma: başka bir istek dosyayı arada değiştirdiyse `conflict` döner, çağıran yeniden dener. */
export type PutResult = 'ok' | 'conflict';

export type Storage = ReturnType<typeof createStorage>;

export function createStorage(config: StorageConfig) {
  const client = new AwsClient({
    accessKeyId: config.accessKeyId,
    secretAccessKey: config.secretAccessKey,
    service: 's3',
    region: 'auto',
  });
  const endpoint = `https://${config.accountId}.r2.cloudflarestorage.com/${config.bucket}`;
  const objectUrl = (key: string) => `${endpoint}/${key.split('/').map(encodeURIComponent).join('/')}`;

  async function expectOk(response: Response, action: string): Promise<Response> {
    if (response.ok) return response;
    const detail = await response.text().catch(() => '');
    throw new Error(`R2 ${action} başarısız (${response.status}): ${detail.slice(0, 300)}`);
  }

  return {
    /**
     * Dosyayı R2'den okur, gövdeyi belleğe almadan akış olarak döner. `ifNoneMatch` verilirse ve dosya değişmediyse
     * R2 304 döner, o da olduğu gibi iletilir. Dosya yoksa `null`.
     */
    async getObject(key: string, method: 'GET' | 'HEAD', ifNoneMatch: string | null): Promise<Response | null> {
      const headers: Record<string, string> = {};
      if (ifNoneMatch) headers['If-None-Match'] = ifNoneMatch;
      const response = await client.fetch(objectUrl(key), { method, headers });
      if (response.status === 404) return null;
      if (response.status === 304) return response;
      return expectOk(response, `${method} ${key}`);
    },

    async getJson(key: string): Promise<StoredJson | null> {
      const response = await client.fetch(objectUrl(key));
      if (response.status === 404) return null;
      await expectOk(response, `GET ${key}`);
      // R2 sıkıştırarak gönderdiği yanıtta ETag'i zayıf (`W/"…"`) verir, `If-Match` ise zayıf ETag'i hiç eşleştirmez
      // ve her yazma 412 alır. Değer aynı MD5'tir: önek atılınca koşullu yazma doğru çalışır.
      return { data: await response.json(), etag: (response.headers.get('etag') ?? '').replace(/^W\//, '') };
    },

    /** `etag` verilirse yalnızca dosya o sürümdeyse, `null` verilirse yalnızca dosya yoksa yazar. */
    async putJson(key: string, data: unknown, etag: string | null): Promise<PutResult> {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-cache',
      };
      if (etag === null) headers['If-None-Match'] = '*';
      else headers['If-Match'] = etag;

      const response = await client.fetch(objectUrl(key), { method: 'PUT', headers, body: JSON.stringify(data) });
      if (response.status === 412) return 'conflict';
      await expectOk(response, `PUT ${key}`);
      return 'ok';
    },

    async head(key: string): Promise<ObjectInfo | null> {
      const response = await client.fetch(objectUrl(key), { method: 'HEAD' });
      if (response.status === 404) return null;
      await expectOk(response, `HEAD ${key}`);
      return {
        size: Number(response.headers.get('content-length') ?? 0),
        contentType: response.headers.get('content-type'),
      };
    },

    async delete(key: string): Promise<void> {
      const response = await client.fetch(objectUrl(key), { method: 'DELETE' });
      // Zaten silinmiş dosya hata sayılmaz.
      if (response.status !== 404) await expectOk(response, `DELETE ${key}`);
    },

    /**
     * Tarayıcının dosyayı doğrudan R2'ye yüklemesi için süreli imzalı PUT adresi. Verilen başlıklar imzaya dahildir:
     * tarayıcı aynı `Content-Type` ve `Cache-Control` değerlerini göndermek zorundadır.
     */
    async presignPut(key: string, headers: Record<string, string>, expiresInSeconds: number): Promise<string> {
      const url = new URL(objectUrl(key));
      url.searchParams.set('X-Amz-Expires', String(expiresInSeconds));
      const signed = await client.sign(new Request(url, { method: 'PUT', headers }), {
        aws: { signQuery: true, allHeaders: true },
      });
      return signed.url;
    },
  };
}
