import '../../i18n/admin';

import { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { ADMIN_BASE_PATH } from '../../content/adminNavigation';
import { type AdminUser, fetchAdminSession, logoutAdmin } from './adminApi';
import { AdminLogin } from './AdminLogin';
import { AdminShell } from './AdminShell';

type AuthState = { status: 'loading' } | { status: 'guest' } | { status: 'signedIn'; user: AdminUser };

const BOOT_CURTAIN_ID = 'boot-curtain';

/** Panel sitenin perdesini kullanmaz: oturum kontrolü bitene kadar açılış perdesi bekler, sonra kaldırılır. */
function removeBootCurtain() {
  document.getElementById(BOOT_CURTAIN_ID)?.remove();
  delete document.documentElement.dataset.pageCurtain;
}

/**
 * `/admin-panel` ve altındaki tüm yolların kökü. Sitenin header'ı, perdesi ve smooth scroll'u burada yoktur.
 * Oturum yoksa hangi panel adresi açılmış olursa olsun giriş formu aynı adreste gösterilir, giriş yapılınca
 * o sayfa açılır.
 */
export function AdminRoot() {
  const { t, i18n } = useTranslation('admin');
  const navigate = useNavigate();
  const [auth, setAuth] = useState<AuthState>({ status: 'loading' });

  useLayoutEffect(() => {
    document.documentElement.lang = i18n.language;
  }, [i18n.language]);

  useEffect(() => {
    document.title = import.meta.env.DEV ? `(Dev) ${t('meta.title')}` : t('meta.title');
  }, [t]);

  useEffect(() => {
    let isActive = true;
    fetchAdminSession()
      .then((user) => isActive && setAuth(user ? { status: 'signedIn', user } : { status: 'guest' }))
      .catch(() => isActive && setAuth({ status: 'guest' }));
    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    if (auth.status !== 'loading') removeBootCurtain();
  }, [auth.status]);

  const handleLogout = useCallback(async () => {
    // Sunucuya ulaşılamasa da arayüzde oturum kapanır; çerez süresi dolunca geçersiz olur.
    await logoutAdmin().catch(() => undefined);
    setAuth({ status: 'guest' });
    void navigate(ADMIN_BASE_PATH, { replace: true });
  }, [navigate]);

  return (
    <>
      {/* React 19 bu etiketi <head>'e taşır. Yayında ayrıca X-Robots-Tag başlığı gönderilir (vercel.json). */}
      <meta name="robots" content="noindex, nofollow" />
      {auth.status === 'guest' && <AdminLogin onSuccess={(user) => setAuth({ status: 'signedIn', user })} />}
      {auth.status === 'signedIn' && <AdminShell user={auth.user} onLogout={handleLogout} />}
    </>
  );
}
