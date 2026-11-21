import { useTranslation } from 'react-i18next';
import { COMPANY, getMapEmbedUrl, MAP_SEARCH_URL } from '../../content/company';
import { useOfficeHours } from '../../hooks/useOfficeHours';
import { RollArrow, RollText } from '../ui/RollText/RollText';
import styles from './ContactMap.module.css';

/** Kapanış bölümü: açık tonlu harita, konumda atan işaret ve adres kartı. */
export function ContactMap() {
  const { t, i18n } = useTranslation('contact');
  const { hoursLines } = useOfficeHours();

  return (
    <section className={styles.section} data-surface="light">
      <div className={styles.stage}>
        <div className={styles.map} data-reveal>
          {/* Harita görsel olarak kullanılır: yumuşak scroll ve özel imleç iframe içinde çalışmaz. Etkileşim için
              karttaki "Haritada aç" bağlantısı kullanılır. */}
          <iframe
            className={styles.frame}
            src={getMapEmbedUrl(i18n.language)}
            title={t('map.frameTitle', { company: COMPANY.name })}
            loading="lazy"
            tabIndex={-1}
            referrerPolicy="no-referrer-when-downgrade"
          />
          {/* Haritanın kendi işaretinin ucunda vurgu renginde atan halkalar. */}
          <span className={styles.pin} aria-hidden="true">
            <span className={styles.pulse} />
            <span className={styles.pulse} />
            <span className={styles.core} />
          </span>
        </div>

        <div className={styles.card} data-reveal>
          <dl className={styles.specs}>
            <div className={styles.spec}>
              <dt className={styles.specLabel}>{t('map.companyLabel')}</dt>
              <dd className={styles.company}>{COMPANY.name}</dd>
            </div>
            <div className={styles.spec}>
              <dt className={styles.specLabel}>{t('map.addressLabel')}</dt>
              <dd className={styles.specValue}>
                {COMPANY.address.lines.map((line) => (
                  <span key={line}>{line}</span>
                ))}
              </dd>
            </div>
            <div className={styles.spec}>
              <dt className={styles.specLabel}>{t('map.hoursLabel')}</dt>
              <dd className={styles.specValue}>
                {hoursLines.map((line) => (
                  <span key={line}>{line}</span>
                ))}
              </dd>
            </div>
          </dl>

          <div className={styles.actions}>
            <a className={styles.action} href={MAP_SEARCH_URL} target="_blank" rel="noreferrer">
              <RollText text={t('map.openInMaps')} />
              <RollArrow />
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
