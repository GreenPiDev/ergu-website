import type { InputHTMLAttributes, ReactNode } from 'react';
import styles from './GenericCheckbox.module.css';

type GenericCheckboxProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'className'> & {
  /** Çevrilmiş etiket. Kutunun yanında büyük yazıyla durur. */
  label: ReactNode;
  /** Etiketin altındaki açıklama, isteğe bağlıdır. */
  description?: ReactNode;
  /** Etiketten önce gösterilen kısa işaret, ör. "01". Ekran okuyucuya okunmaz. */
  marker?: ReactNode;
  className?: string;
};

/**
 * Kare çerçeveli onay kutusu. İşaretlenince içini kutu rengiyle dolu bir kare kaplar, metin geri çekilir.
 * Renk `currentColor`'dan gelir, her zeminde çalışır. Gerçek `input` görünmez ama dokunma alanını kaplar,
 * klavye, form ve ekran okuyucu davranışı yereldir. Kontrollü (`checked` + `onChange`) veya kontrolsüz kullanılabilir.
 */
export function GenericCheckbox({ label, description, marker, className = '', ...inputProps }: GenericCheckboxProps) {
  return (
    <label className={`${styles.row} ${marker === undefined ? '' : styles.withMarker} ${className}`}>
      <input className={styles.input} type="checkbox" {...inputProps} />
      <span className={styles.box} aria-hidden="true" />
      {marker !== undefined && (
        <span className={styles.marker} aria-hidden="true">
          {marker}
        </span>
      )}
      <span className={styles.copy}>
        <span className={styles.label}>{label}</span>
        {description && <span className={styles.description}>{description}</span>}
      </span>
    </label>
  );
}
