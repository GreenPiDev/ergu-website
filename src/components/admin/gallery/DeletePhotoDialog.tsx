import { WarningCircleIcon } from '@phosphor-icons/react/dist/csr/WarningCircle';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AdminDialog } from '../AdminDialog';
import { type AdminPhoto, deletePhoto } from './galleryAdminApi';
import { galleryErrorKey } from './galleryErrors';
import styles from './PhotoFormDialog.module.css';

type DeletePhotoDialogProps = {
  photo: AdminPhoto;
  onClose: () => void;
  onDeleted: (id: string) => void;
};

/** Silme onayı. Tarayıcının `confirm` penceresi yerine panelin kendi penceresi kullanılır. */
export function DeletePhotoDialog({ photo, onClose, onDeleted }: DeletePhotoDialogProps) {
  const { t } = useTranslation('admin');
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    setIsDeleting(true);
    setError(null);
    try {
      await deletePhoto(photo.id);
      onDeleted(photo.id);
    } catch (cause) {
      setError(t(galleryErrorKey(cause)));
      setIsDeleting(false);
    }
  };

  return (
    <AdminDialog
      title={t('gallery.delete.title')}
      closeLabel={t('gallery.form.close')}
      isBusy={isDeleting}
      size="small"
      onClose={onClose}
    >
      <div className={styles.form}>
        <img className={styles.currentImage} src={photo.thumbUrl} alt="" />
        <p className={styles.hint}>{t('gallery.delete.body')}</p>
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
            {t('gallery.delete.cancel')}
          </button>
          <button className={styles.danger} type="button" onClick={handleDelete} disabled={isDeleting}>
            {t(isDeleting ? 'gallery.delete.deleting' : 'gallery.delete.confirm')}
          </button>
        </div>
      </div>
    </AdminDialog>
  );
}
