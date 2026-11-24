/**
 * Yönetim panelinin sunucu ayarları. Değerler ortam değişkenlerinden okunur, kodda gizli bilgi tutulmaz.
 *
 * - `ADMIN_EMAIL`: giriş e-postası.
 * - `ADMIN_PASSWORD_HASH`: şifrenin scrypt özeti. `node scripts/admin-password-hash.mjs <şifre>` ile üretilir.
 * - `ADMIN_SESSION_SECRET`: oturum çerezini imzalayan gizli anahtar, en az 32 karakter.
 *
 * Yerelde `.env.local` dosyasından, yayında Vercel proje ayarlarındaki ortam değişkenlerinden gelir.
 */
export type AdminConfig = {
  email: string;
  passwordHash: string;
  sessionSecret: string;
};

const MIN_SECRET_LENGTH = 32;

export class AdminConfigError extends Error {}

export function readAdminConfig(): AdminConfig {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const passwordHash = process.env.ADMIN_PASSWORD_HASH?.trim();
  const sessionSecret = process.env.ADMIN_SESSION_SECRET?.trim();

  if (!email || !passwordHash || !sessionSecret || sessionSecret.length < MIN_SECRET_LENGTH) {
    throw new AdminConfigError('Yönetim paneli ortam değişkenleri eksik veya hatalı.');
  }
  return { email, passwordHash, sessionSecret };
}
