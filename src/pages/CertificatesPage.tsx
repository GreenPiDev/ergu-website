import '../i18n/certificates';
import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { usePageRevealHold } from '../animations/pageReveal';
import { CertificateTrack } from '../components/certificates/CertificateTrack';
import { useCertificates } from '../components/certificates/certificatesApi';
import { PageHero } from '../components/layout/PageHero/PageHero';
import { useHiddenScrollbar } from '../hooks/useHiddenScrollbar';
import styles from './CertificatesPage.module.css';

// Perde liste gelene kadar bekler; yavaş bağlantıda sayfa perdede kalmasın diye sınırlıdır.
const REVEAL_HOLD_MS = 6000;

/**
 * Belgelerimiz: sertifikalar yöneticiler tarafından yüklenir, liste API'den gelir (certificatesApi.ts). Sayfa dikey
 * kaymaz, belgeler hero'nun altındaki yatay şeritte gezilir (CertificateTrack).
 */
export function CertificatesPage() {
  const { t, i18n } = useTranslation();
  const { t: tCertificates } = useTranslation('certificates');
  const state = useCertificates();
  // Sayfa yatay gezilir, dikey scrollbar yanıltıcı olurdu.
  useHiddenScrollbar();
  usePageRevealHold(state.status !== 'loading', REVEAL_HOLD_MS);
  // Hero ve şerit tek kapsayıcıdadır, yatay gezinirken ikisi birlikte sabit kalır.
  const pageRef = useRef<HTMLDivElement>(null);

  return (
    <div ref={pageRef}>
      <PageHero title={t('nav.main.certificates').toLocaleUpperCase(i18n.language)} />
      {state.status === 'ready' && state.certificates.length > 0 ? (
        <CertificateTrack certificates={state.certificates} pinRef={pageRef} />
      ) : (
        <section className={styles.status} data-surface="light">
          <p className={styles.message} role="status">
            {state.status === 'loading' && tCertificates('status.loading')}
            {state.status === 'error' && tCertificates('status.error')}
            {state.status === 'ready' && tCertificates('status.empty')}
          </p>
        </section>
      )}
    </div>
  );
}
