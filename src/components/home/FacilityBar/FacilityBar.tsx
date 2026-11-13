import type { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { FACILITY_IDS, type FacilityId, facilityColorToken } from '../../../content/facilities';
import styles from './FacilityBar.module.css';

interface FacilityBarProps {
  selected: FacilityId | null;
  /** Seçili butona yeniden basınca seçim kalkar (null). */
  onSelect: (facility: FacilityId | null) => void;
  /** Fareyle butonun üstüne gelince lokasyon, ayrılınca null. Yalnızca fare: dokunmada tıklama yeterli. */
  onPreview: (facility: FacilityId | null) => void;
}

/** Şehir hero'sunun altında, sağa yaslı tek satır lokasyon butonları (Barlow). Dar ekranda satır yatay kayar. */
export function FacilityBar({ selected, onSelect, onPreview }: FacilityBarProps) {
  const { t } = useTranslation();

  return (
    <div className={styles.root} role="group" aria-label={t('home.facilities.label')}>
      <ul className={styles.list}>
        {FACILITY_IDS.map((id) => (
          <li key={id}>
            <button
              type="button"
              className={styles.button}
              // Seçili ve hover çerçevesi perdeyle aynı renkte: lokasyonun token'ı.
              style={{ '--facility-color': `var(${facilityColorToken(id)})` } as CSSProperties}
              aria-pressed={selected === id}
              onClick={() => onSelect(selected === id ? null : id)}
              onPointerEnter={(event) => event.pointerType === 'mouse' && onPreview(id)}
              onPointerLeave={(event) => event.pointerType === 'mouse' && onPreview(null)}
            >
              {t(`home.facilities.items.${id}`)}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
