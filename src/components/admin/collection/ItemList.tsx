import { PencilSimpleIcon } from '@phosphor-icons/react/dist/csr/PencilSimple';
import { TrashIcon } from '@phosphor-icons/react/dist/csr/Trash';
import { useTranslation } from 'react-i18next';
import type { AdminCollection, AdminItem } from './collectionAdminApi';
import styles from './ItemList.module.css';

type ItemListProps = {
  collection: AdminCollection;
  items: AdminItem[];
  onEdit: (item: AdminItem) => void;
  onDelete: (item: AdminItem) => void;
};

/** Koleksiyondaki kayıtlar, sitedeki gösterim sırasıyla (en yeni üstte). */
export function ItemList({ collection, items, onEdit, onDelete }: ItemListProps) {
  const { t, i18n } = useTranslation('admin');
  const { id } = collection;
  const numberFormat = new Intl.NumberFormat(i18n.language);

  return (
    <ul className={styles.list} data-shape={collection.thumbShape} aria-label={t(`${id}.listLabel`)}>
      {items.map((item) => {
        const name = item.title.tr || item.title.en || t(`${id}.item.untitled`);
        const hasEnglish = Boolean(item.title.en || item.description.en);
        return (
          <li key={item.id} className={styles.item}>
            <img
              className={styles.thumb}
              src={item.thumbUrl}
              width={item.width}
              height={item.height}
              alt={t(`${id}.item.thumbAlt`, { name })}
              loading="lazy"
              decoding="async"
            />
            <div className={styles.copy}>
              <p className={`${styles.title} ${item.title.tr ? '' : styles.muted}`}>{name}</p>
              <p className={styles.description}>{item.description.tr || t(`${id}.item.noDescription`)}</p>
              <p className={styles.meta}>
                {!hasEnglish && <span className={styles.badge}>{t(`${id}.item.englishMissing`)}</span>}
                <span>
                  {t(`${id}.item.dimensions`, {
                    width: numberFormat.format(item.width),
                    height: numberFormat.format(item.height),
                  })}
                </span>
              </p>
            </div>
            <div className={styles.actions}>
              <button
                className={styles.action}
                type="button"
                aria-label={t(`${id}.item.editLabel`, { name })}
                onClick={() => onEdit(item)}
              >
                <PencilSimpleIcon aria-hidden="true" />
                <span aria-hidden="true">{t(`${id}.item.edit`)}</span>
              </button>
              <button
                className={`${styles.action} ${styles.deleteAction}`}
                type="button"
                aria-label={t(`${id}.item.deleteLabel`, { name })}
                onClick={() => onDelete(item)}
              >
                <TrashIcon aria-hidden="true" />
                <span aria-hidden="true">{t(`${id}.item.delete`)}</span>
              </button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
