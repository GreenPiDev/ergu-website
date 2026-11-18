import { useTranslation } from 'react-i18next';
import { PageHero } from '../components/layout/PageHero/PageHero';
import type { NavLabelKey } from '../content/navigation';
import styles from './PlaceholderPage.module.css';

/** Menüde olan ama içeriği henüz yazılmamış sayfa: başlıklı hero ve görünür yer tutucu. */
export function PlaceholderPage({ labelKey }: { labelKey: NavLabelKey }) {
  const { t, i18n } = useTranslation();

  return (
    <PageHero title={t(labelKey).toLocaleUpperCase(i18n.language)}>
      <div className={styles.body}>
        <p className={styles.name}>{t(labelKey)}</p>
        <p className={styles.note}>{t('placeholderPage.note')}</p>
      </div>
    </PageHero>
  );
}
