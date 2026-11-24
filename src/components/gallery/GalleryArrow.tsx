import { ArrowLeftIcon } from '@phosphor-icons/react/dist/csr/ArrowLeft';
import { ArrowRightIcon } from '@phosphor-icons/react/dist/csr/ArrowRight';
import styles from './GalleryArrow.module.css';

interface GalleryArrowProps {
  direction: 1 | -1;
  label: string;
  onClick: () => void;
  className?: string;
}

/** Galerinin önceki/sonraki düğmesi: ince çerçeveli daire, farede vurgu rengiyle dolar. */
export function GalleryArrow({ direction, label, onClick, className = '' }: GalleryArrowProps) {
  const Icon = direction === 1 ? ArrowRightIcon : ArrowLeftIcon;
  return (
    <button className={`${styles.root} ${className}`} type="button" aria-label={label} onClick={onClick}>
      <Icon className={styles.icon} aria-hidden="true" />
    </button>
  );
}
