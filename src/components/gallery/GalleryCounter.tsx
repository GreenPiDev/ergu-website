import { useMemo } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import styles from './GalleryCounter.module.css';

interface GalleryCounterProps {
  index: number;
  total: number;
  className?: string;
}

/** 014 / 186 biçiminde sayaç. Sayılar aktif dile göre biçimlenir, hane sayısı toplamdan gelir. */
export function GalleryCounter({ index, total, className = '' }: GalleryCounterProps) {
  const { i18n } = useTranslation('gallery');
  const format = useMemo(
    () =>
      new Intl.NumberFormat(i18n.language, {
        minimumIntegerDigits: Math.max(2, String(total).length),
        useGrouping: false,
      }),
    [i18n.language, total],
  );

  return (
    // Sayaç görseldir; ekran okuyucular değişikliği ayrı bir canlı bölgeden duyar.
    <p className={`${styles.root} ${className}`} aria-hidden="true">
      <Trans
        ns="gallery"
        i18nKey="counter"
        values={{ current: format.format(index + 1), total: format.format(total) }}
        components={{
          current: <span className={styles.current} />,
          separator: <span className={styles.separator} />,
          total: <span className={styles.total} />,
        }}
      />
    </p>
  );
}
