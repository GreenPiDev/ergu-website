import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { usePrefersReducedMotion } from '../../hooks/useDevice';
import type { GalleryImage } from './galleryApi';
import styles from './GalleryThumbnails.module.css';

// Şerit ritmi bozulmasın diye çok geniş veya çok dar fotoğraflar bu oranlara kırpılır. Alt sınır dokunma alanını korur.
const MIN_ASPECT = 0.8;
const MAX_ASPECT = 1.8;

interface GalleryThumbnailsProps {
  images: readonly GalleryImage[];
  activeIndex: number;
  /** Şeridin ortaladığı fotoğraf. Silindir kayarken öndeki değil varılacak fotoğraftır, şerit tek seferde kayar. */
  focusIndex: number;
  onSelect: (index: number) => void;
}

/** Bütün fotoğrafların küçük halleri. Silindirin varacağı fotoğraf değiştikçe şerit onu ortaya kaydırır. */
export function GalleryThumbnails({ images, activeIndex, focusIndex, onSelect }: GalleryThumbnailsProps) {
  const { t } = useTranslation('gallery');
  const prefersReducedMotion = usePrefersReducedMotion();
  const listRef = useRef<HTMLUListElement>(null);

  // Sayfa değil yalnızca şerit kayar (scrollIntoView sayfayı da kaydırırdı).
  useEffect(() => {
    const list = listRef.current;
    const item = list?.children[focusIndex];
    if (!list || !(item instanceof HTMLElement)) return;
    list.scrollTo({
      left: item.offsetLeft - (list.clientWidth - item.offsetWidth) / 2,
      behavior: prefersReducedMotion ? 'auto' : 'smooth',
    });
  }, [focusIndex, prefersReducedMotion]);

  return (
    <nav className={styles.root} aria-label={t('thumbnails')}>
      <ul ref={listRef} className={styles.list}>
        {images.map((image, index) => {
          const aspect = Math.min(MAX_ASPECT, Math.max(MIN_ASPECT, image.width / image.height));
          const isActive = index === activeIndex;
          return (
            <li key={image.id} className={styles.item}>
              <button
                type="button"
                className={styles.button}
                style={{ aspectRatio: aspect }}
                aria-label={t('thumbnail', { number: index + 1 })}
                aria-current={isActive ? 'true' : undefined}
                onClick={() => onSelect(index)}
              >
                <img
                  className={styles.image}
                  src={image.thumbUrl}
                  // Düğmenin adı aria-label'dadır, görsel ayrıca okunmaz.
                  alt=""
                  loading="lazy"
                  decoding="async"
                  draggable={false}
                />
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
