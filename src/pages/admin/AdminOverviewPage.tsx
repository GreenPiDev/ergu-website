import { Trans, useTranslation } from 'react-i18next';
import { useAdminUser } from '../../components/admin/adminApi';
import styles from './AdminPage.module.css';

/** Panelin giriş sayfası (`/admin-panel`). İçerik bölümleri eklendikçe buradan da erişilecek. */
export function AdminOverviewPage() {
  const { t } = useTranslation('admin');
  const { email } = useAdminUser();

  return (
    <>
      <section className={styles.header} data-surface="light">
        <p className={styles.eyebrow}>{t('overview.eyebrow')}</p>
        <h1 className={styles.title}>{t('overview.title')}</h1>
        <p className={styles.lead}>
          <Trans t={t} i18nKey="overview.lead" values={{ email }} components={[<strong key="email" />]} />
        </p>
      </section>

      <section className={styles.body} data-surface="light" data-tone="white" aria-labelledby="admin-modules-title">
        <h2 id="admin-modules-title" className={styles.sectionTitle}>
          {t('overview.modules.title')}
        </h2>
        <p className={styles.empty}>{t('overview.modules.empty')}</p>
      </section>
    </>
  );
}
