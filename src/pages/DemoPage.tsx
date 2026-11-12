import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { SectionRail } from '../components/ui/SectionRail/SectionRail';
import { useDevice } from '../hooks/useDevice';
import styles from './DemoPage.module.css';

const SURFACES = ['dark', 'light'] as const;

/** Geçici test sayfası: header'ın zemine göre renk değişimini ve cihaz hook'larını gösterir. */
export function DemoPage() {
  const { t } = useTranslation();
  const device = useDevice();
  const sequenceRef = useRef<HTMLDivElement>(null);
  const railItems = SURFACES.map((surface) => ({ key: surface, label: t(`demo.${surface}.eyebrow`) }));

  return (
    <>
      <div ref={sequenceRef}>
        {SURFACES.map((surface) => (
          <section key={surface} className={styles.section} data-surface={surface}>
            <p className={styles.eyebrow}>{t(`demo.${surface}.eyebrow`)}</p>
            <h1 className={styles.title}>{t(`demo.${surface}.title`)}</h1>
            <p className={styles.device}>{t('demo.detectedDevice', { device: t(`device.${device}`) })}</p>
          </section>
        ))}
      </div>

      <SectionRail sequenceRef={sequenceRef} items={railItems} />
    </>
  );
}
