import { PencilSimpleIcon } from '@phosphor-icons/react/dist/csr/PencilSimple';
import { TrashIcon } from '@phosphor-icons/react/dist/csr/Trash';
import { useTranslation } from 'react-i18next';
import type { AdminPhoto } from './galleryAdminApi';
import styles from './PhotoList.module.css';

type PhotoListProps = {
  photos: AdminPhoto[];
  onEdit: (photo: AdminPhoto) => void;
  onDelete: (photo: AdminPhoto) => void;
};

/** Galerideki fotoğraflar, sitedeki gösterim sırasıyla (en yeni üstte). */
export function PhotoList({ photos, onEdit, onDelete }: PhotoListProps) {
  const { t, i18n } = useTranslation('admin');
  const numberFormat = new Intl.NumberFormat(i18n.language);

  return (
    <ul className={styles.list} aria-label={t('gallery.listLabel')}>
      {photos.map((photo) => {
        const name = photo.title.tr || photo.title.en || t('gallery.item.untitled');
        const hasEnglish = Boolean(photo.title.en || photo.description.en);
        return (
          <li key={photo.id} className={styles.item}>
            <img
              className={styles.thumb}
              src={photo.thumbUrl}
              width={photo.width}
              height={photo.height}
              alt={t('gallery.item.thumbAlt', { name })}
              loading="lazy"
              decoding="async"
            />
            <div className={styles.copy}>
              <p className={`${styles.title} ${photo.title.tr ? '' : styles.muted}`}>{name}</p>
              <p className={styles.description}>{photo.description.tr || t('gallery.item.noDescription')}</p>
              <p className={styles.meta}>
                {!hasEnglish && <span className={styles.badge}>{t('gallery.item.englishMissing')}</span>}
                <span>
                  {t('gallery.item.dimensions', {
                    width: numberFormat.format(photo.width),
                    height: numberFormat.format(photo.height),
                  })}
                </span>
              </p>
            </div>
            <div className={styles.actions}>
              <button
                className={styles.action}
                type="button"
                aria-label={t('gallery.item.editLabel', { name })}
                onClick={() => onEdit(photo)}
              >
                <PencilSimpleIcon aria-hidden="true" />
                <span aria-hidden="true">{t('gallery.item.edit')}</span>
              </button>
              <button
                className={`${styles.action} ${styles.deleteAction}`}
                type="button"
                aria-label={t('gallery.item.deleteLabel', { name })}
                onClick={() => onDelete(photo)}
              >
                <TrashIcon aria-hidden="true" />
                <span aria-hidden="true">{t('gallery.item.delete')}</span>
              </button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
