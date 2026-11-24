import { WarningCircleIcon } from '@phosphor-icons/react/dist/csr/WarningCircle';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AdminDialog } from '../AdminDialog';
import { type AdminCollection, type AdminItem, deleteItem } from './collectionAdminApi';
import { collectionErrorKey } from './collectionErrors';
import styles from './ItemFormDialog.module.css';

type DeleteItemDialogProps = {
  collection: AdminCollection;
  item: AdminItem;
  onClose: () => void;
  onDeleted: (id: string) => void;
};

/** Silme onayı. Tarayıcının `confirm` penceresi yerine panelin kendi penceresi kullanılır. */
export function DeleteItemDialog({ collection, item, onClose, onDeleted }: DeleteItemDialogProps) {
  const { t } = useTranslation('admin');
  const { id } = collection;
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    setIsDeleting(true);
    setError(null);
    try {
      await deleteItem(collection, item.id);
      onDeleted(item.id);
    } catch (cause) {
      setError(t(`${id}.errors.${collectionErrorKey(cause)}`));
      setIsDeleting(false);
    }
  };

  return (
    <AdminDialog
      title={t(`${id}.delete.title`)}
      closeLabel={t(`${id}.form.close`)}
      isBusy={isDeleting}
      size="small"
      onClose={onClose}
    >
      <div className={styles.form}>
        <img className={styles.currentImage} src={item.thumbUrl} alt="" />
        <p className={styles.hint}>{t(`${id}.delete.body`)}</p>
        <p className={styles.alert} role="alert">
          {error && (
            <>
              <WarningCircleIcon aria-hidden="true" weight="fill" />
              {error}
            </>
          )}
        </p>
        <div className={styles.actions}>
          <button className={styles.secondary} type="button" onClick={onClose} disabled={isDeleting}>
            {t(`${id}.delete.cancel`)}
          </button>
          <button className={styles.danger} type="button" onClick={handleDelete} disabled={isDeleting}>
            {t(isDeleting ? `${id}.delete.deleting` : `${id}.delete.confirm`)}
          </button>
        </div>
      </div>
    </AdminDialog>
  );
}
