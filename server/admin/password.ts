import { scrypt, timingSafeEqual, type ScryptOptions } from 'node:crypto';

/**
 * Şifre özeti biçimi: `scrypt:N:r:p:tuz:özet` (tuz ve özet base64url). Ayraç olarak `$` kullanılmaz, yoksa
 * `.env` dosyalarındaki değişken açma özelliği değeri bozar. Üretici: `scripts/admin-password-hash.mjs`.
 */
const HASH_PREFIX = 'scrypt';

function deriveKey(password: string, salt: Buffer, keyLength: number, options: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, keyLength, options, (error, key) => (error ? reject(error) : resolve(key)));
  });
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const parts = storedHash.split(':');
  if (parts.length !== 6 || parts[0] !== HASH_PREFIX) return false;

  const [, n, r, p, saltText, hashText] = parts;
  const expected = Buffer.from(hashText, 'base64url');
  const options: ScryptOptions = {
    N: Number(n),
    r: Number(r),
    p: Number(p),
    maxmem: 64 * 1024 * 1024,
  };
  if (
    expected.length === 0 ||
    !Number.isInteger(options.N) ||
    !Number.isInteger(options.r) ||
    !Number.isInteger(options.p)
  ) {
    return false;
  }

  const actual = await deriveKey(password, Buffer.from(saltText, 'base64url'), expected.length, options);
  return timingSafeEqual(actual, expected);
}
