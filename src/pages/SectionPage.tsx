import { useTranslation } from 'react-i18next';
import { PageHero } from '../components/layout/PageHero/PageHero';
import type { NAV_ITEMS } from '../content/navigation';
import { DemoPage } from './DemoPage';

type NavKey = (typeof NAV_ITEMS)[number]['key'];

/** İçeriği henüz yazılmamış sayfalar: sayfa başlıklı hero ve altında geçici test bölümleri. */
export function SectionPage({ navKey }: { navKey: NavKey }) {
  const { t, i18n } = useTranslation();

  return (
    <>
      <PageHero title={t(`nav.items.${navKey}`).toLocaleUpperCase(i18n.language)} />
      <DemoPage />
    </>
  );
}
