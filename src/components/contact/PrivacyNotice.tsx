import { useTranslation } from 'react-i18next';
import { COMPANY } from '../../content/company';
import styles from './PrivacyNotice.module.css';

// KVKK md. 10'un istediği başlıklar, metindeki sırasıyla. Haklar ve başvuru ayrıca yazılır.
const SECTIONS = ['controller', 'data', 'purposes', 'legalBasis', 'transfer', 'retention'] as const;

/**
 * İletişim formunun KVKK aydınlatma metni. Firma adı, adres ve e-posta `company.ts`'ten gelir.
 * Uzun olduğu için kendi içinde kayar; klavyeyle de kaydırılabilsin diye odaklanabilir bölgedir.
 */
export function PrivacyNotice() {
  const { t } = useTranslation('contact');
  const company = {
    company: COMPANY.name,
    address: COMPANY.address.lines.join(', '),
    email: COMPANY.emails[0],
  };
  const rights = t('form.consent.notice.rights.items', { returnObjects: true });

  return (
    <div
      className={styles.notice}
      role="region"
      aria-label={t('form.consent.notice.regionLabel')}
      tabIndex={0}
      data-lenis-prevent
    >
      <h3 className={styles.title}>{t('form.consent.notice.title')}</h3>
      <p className={styles.draft}>{t('form.consent.notice.draftNote')}</p>

      {SECTIONS.map((key) => (
        <section key={key} className={styles.section}>
          <h4 className={styles.heading}>{t(`form.consent.notice.sections.${key}.heading`)}</h4>
          <p>{t(`form.consent.notice.sections.${key}.body`, company)}</p>
        </section>
      ))}

      <section className={styles.section}>
        <h4 className={styles.heading}>{t('form.consent.notice.rights.heading')}</h4>
        <p>{t('form.consent.notice.rights.intro')}</p>
        <ul className={styles.list}>
          {rights.map((right) => (
            <li key={right}>{right}</li>
          ))}
        </ul>
      </section>

      <section className={styles.section}>
        <h4 className={styles.heading}>{t('form.consent.notice.application.heading')}</h4>
        <p>{t('form.consent.notice.application.body', company)}</p>
      </section>
    </div>
  );
}
