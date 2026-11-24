// Yönetim paneli şifresinin scrypt özetini üretir: node scripts/admin-password-hash.mjs '<şifre>'
// Çıktı ADMIN_PASSWORD_HASH ortam değişkenine yazılır. Biçim server/admin/password.ts ile aynıdır.
import { randomBytes, scryptSync } from 'node:crypto';

const password = process.argv[2];
if (!password) {
  console.error("Kullanım: node scripts/admin-password-hash.mjs '<şifre>'");
  process.exit(1);
}

const [N, r, p, keyLength] = [16384, 8, 1, 32];
const salt = randomBytes(16);
const hash = scryptSync(password, salt, keyLength, { N, r, p });

console.log(['scrypt', N, r, p, salt.toString('base64url'), hash.toString('base64url')].join(':'));
