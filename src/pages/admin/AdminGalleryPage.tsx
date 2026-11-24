import { ArrowClockwiseIcon } from '@phosphor-icons/react/dist/csr/ArrowClockwise';
import { UploadSimpleIcon } from '@phosphor-icons/react/dist/csr/UploadSimple';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DeletePhotoDialog } from '../../components/admin/gallery/DeletePhotoDialog';
import { type AdminPhoto, fetchPhotos } from '../../components/admin/gallery/galleryAdminApi';
import { galleryErrorKey } from '../../components/admin/gallery/galleryErrors';
import { PhotoFormDialog, type PhotoFormMode } from '../../components/admin/gallery/PhotoFormDialog';
import { PhotoList } from '../../components/admin/gallery/PhotoList';
import styles from './AdminPage.module.css';

type ListState =
  | { status: 'loading' }
  | { status: 'error'; messageKey: ReturnType<typeof galleryErrorKey> }
  | { status: 'ready'; photos: AdminPhoto[] };

/** Fotoğraf galerisi yönetimi (`/admin-panel/gallery`): listeleme, yükleme, metin düzenleme ve silme. */
export function AdminGalleryPage() {
  const { t } = useTranslation('admin');
  const [list, setList] = useState<ListState>({ status: 'loading' });
  const [form, setForm] = useState<PhotoFormMode | null>(null);
  const [deleting, setDeleting] = useState<AdminPhoto | null>(null);
  const [notice, setNotice] = useState('');

  // Listeyi çeker; `reloadCount` artınca (Tekrar dene) yeniden çeker. Sayfadan çıkılırsa sonuç yok sayılır.
  const [reloadCount, setReloadCount] = useState(0);
  useEffect(() => {
    let isActive = true;
    fetchPhotos()
      .then((photos) => isActive && setList({ status: 'ready', photos }))
      .catch((error: unknown) => isActive && setList({ status: 'error', messageKey: galleryErrorKey(error) }));
    return () => {
      isActive = false;
    };
  }, [reloadCount]);

  const retry = () => {
    setList({ status: 'loading' });
    setReloadCount((count) => count + 1);
  };

  const updatePhotos = (change: (photos: AdminPhoto[]) => AdminPhoto[]) =>
    setList((current) => (current.status === 'ready' ? { ...current, photos: change(current.photos) } : current));

  const handleSaved = (photo: AdminPhoto) => {
    const isEdit = form?.kind === 'edit';
    updatePhotos((photos) =>
      isEdit ? photos.map((item) => (item.id === photo.id ? photo : item)) : [photo, ...photos],
    );
    setForm(null);
    setNotice(t(isEdit ? 'gallery.status.updated' : 'gallery.status.uploaded'));
  };

  const handleDeleted = (id: string) => {
    updatePhotos((photos) => photos.filter((item) => item.id !== id));
    setDeleting(null);
    setNotice(t('gallery.status.deleted'));
  };

  return (
    <>
      <section className={styles.header} data-surface="light">
        <p className={styles.eyebrow}>{t('gallery.eyebrow')}</p>
        <div className={styles.titleRow}>
          <h1 className={styles.title}>{t('gallery.title')}</h1>
          <button
            className={styles.primaryButton}
            type="button"
            onClick={() => setForm({ kind: 'create' })}
            disabled={list.status !== 'ready'}
          >
            <UploadSimpleIcon aria-hidden="true" />
            {t('gallery.upload')}
          </button>
        </div>
        <p className={styles.lead}>{t('gallery.lead')}</p>
      </section>

      <section className={styles.body} data-surface="light" data-tone="white">
        <p className={styles.notice} role="status">
          {notice}
        </p>

        {list.status === 'loading' && <p className={styles.empty}>{t('gallery.status.loading')}</p>}

        {list.status === 'error' && (
          <div className={styles.errorBox} role="alert">
            <p>{t(list.messageKey)}</p>
            <button className={styles.secondaryButton} type="button" onClick={retry}>
              <ArrowClockwiseIcon aria-hidden="true" />
              {t('gallery.status.retry')}
            </button>
          </div>
        )}

        {list.status === 'ready' &&
          (list.photos.length === 0 ? (
            <p className={styles.empty}>{t('gallery.status.empty')}</p>
          ) : (
            <>
              <p className={styles.count}>{t('gallery.count', { count: list.photos.length })}</p>
              <PhotoList
                photos={list.photos}
                onEdit={(photo) => setForm({ kind: 'edit', photo })}
                onDelete={setDeleting}
              />
            </>
          ))}
      </section>

      {form && <PhotoFormDialog mode={form} onClose={() => setForm(null)} onSaved={handleSaved} />}
      {deleting && <DeletePhotoDialog photo={deleting} onClose={() => setDeleting(null)} onDeleted={handleDeleted} />}
    </>
  );
}
