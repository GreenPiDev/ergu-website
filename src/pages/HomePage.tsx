import { useTranslation } from 'react-i18next';
import { CityHero } from '../components/home/CityHero/CityHero';
import styles from './HomePage.module.css';

/** Ana sayfa: tam ekran 3D şehir hero'su. */
export function HomePage() {
  const { t } = useTranslation();

  return (
    <section className={styles.hero} data-surface="dark">
      <CityHero />
      {/* Görsel başlık yok, ekran okuyucular ve SEO için sayfa başlığı. */}
      <h1 className={styles.srOnly}>{t('meta.title')}</h1>
    </section>
  );
}
