import type { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { FACILITY_IDS, type FacilityId, facilityColorToken } from '../../../content/facilities';
import { setCursorLabel } from '../../ui/CustomCursor/cursorEvents';
import styles from './FacilityBar.module.css';

interface FacilityBarProps {
  selected: FacilityId | null;
  /** Seçili butona yeniden basınca seçim kalkar (null). */
  onSelect: (facility: FacilityId | null) => void;
  /** Fareyle butonun üstüne gelince lokasyon, ayrılınca null. Yalnızca fare: dokunmada tıklama yeterli. */
  onPreview: (facility: FacilityId | null) => void;
  /** Sol alttaki buton: kamerayı ilk kadraja döndürür, seçimi kaldırır. */
  onReset: () => void;
}

/** Görünümü sıfırla ikonu: sola açık bir halka ve ucunda ok (geri dönüş), ortada nokta (ilk kadraj). Projeye çizildi. */
function ResetIcon() {
  return (
    <svg className={styles.icon} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M5.4 9.6A7 7 0 1 1 5.4 14.4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M8.1 16.6 5.4 14.4 4.8 17.8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="1.4" fill="currentColor" />
    </svg>
  );
}

/** Şehir hero'sunun altında, sağa yaslı tek satır lokasyon butonları (Barlow). Dar ekranda satır yatay kayar. */
export function FacilityBar({ selected, onSelect, onPreview, onReset }: FacilityBarProps) {
  const { t } = useTranslation();

  return (
    <div className={styles.root}>
      {/* Yalnızca ikon: adı ekran okuyucuya aria-label ile, fareyle üstüne gelince imlecin yanındaki etiketle verilir. */}
      <button
        type="button"
        className={`${styles.button} ${styles.reset}`}
        aria-label={t('home.facilities.reset')}
        onClick={onReset}
        onPointerEnter={(event) => event.pointerType === 'mouse' && setCursorLabel({ text: t('home.facilities.reset') })}
        onPointerLeave={(event) => event.pointerType === 'mouse' && setCursorLabel(null)}
      >
        <ResetIcon />
      </button>
      <ul className={styles.list} role="group" aria-label={t('home.facilities.label')}>
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
