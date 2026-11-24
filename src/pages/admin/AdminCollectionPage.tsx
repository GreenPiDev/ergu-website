import { ArrowClockwiseIcon } from '@phosphor-icons/react/dist/csr/ArrowClockwise';
import { UploadSimpleIcon } from '@phosphor-icons/react/dist/csr/UploadSimple';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  type AdminCollection,
  type AdminItem,
  CERTIFICATES_COLLECTION,
  fetchItems,
  GALLERY_COLLECTION,
} from '../../components/admin/collection/collectionAdminApi';
import { type CollectionErrorKey, collectionErrorKey } from '../../components/admin/collection/collectionErrors';
import { DeleteItemDialog } from '../../components/admin/collection/DeleteItemDialog';
import { ItemFormDialog, type ItemFormMode } from '../../components/admin/collection/ItemFormDialog';
import { ItemList } from '../../components/admin/collection/ItemList';
import styles from './AdminPage.module.css';

type ListState =
  | { status: 'loading' }
  | { status: 'error'; errorKey: CollectionErrorKey }
  | { status: 'ready'; items: AdminItem[] };

/** Görsel koleksiyonu yönetimi: listeleme, yükleme, metin düzenleme ve silme. Metinler `admin` › `<id>.*`. */
function AdminCollectionPage({ collection }: { collection: AdminCollection }) {
  const { t } = useTranslation('admin');
  const { id } = collection;
  const [list, setList] = useState<ListState>({ status: 'loading' });
  const [form, setForm] = useState<ItemFormMode | null>(null);
  const [deleting, setDeleting] = useState<AdminItem | null>(null);
  const [notice, setNotice] = useState('');

  // Listeyi çeker; `reloadCount` artınca (Tekrar dene) yeniden çeker. Sayfadan çıkılırsa sonuç yok sayılır.
  const [reloadCount, setReloadCount] = useState(0);
  useEffect(() => {
    let isActive = true;
    fetchItems(collection)
      .then((items) => isActive && setList({ status: 'ready', items }))
      .catch((error: unknown) => isActive && setList({ status: 'error', errorKey: collectionErrorKey(error) }));
    return () => {
      isActive = false;
    };
  }, [collection, reloadCount]);

  const retry = () => {
    setList({ status: 'loading' });
    setReloadCount((count) => count + 1);
  };

  const updateList = (change: (items: AdminItem[]) => AdminItem[]) =>
    setList((current) => (current.status === 'ready' ? { ...current, items: change(current.items) } : current));

  const handleSaved = (saved: AdminItem) => {
    const isEdit = form?.kind === 'edit';
    updateList((items) => (isEdit ? items.map((item) => (item.id === saved.id ? saved : item)) : [saved, ...items]));
    setForm(null);
    setNotice(t(isEdit ? `${id}.status.updated` : `${id}.status.uploaded`));
  };

  const handleDeleted = (deletedId: string) => {
    updateList((items) => items.filter((item) => item.id !== deletedId));
    setDeleting(null);
    setNotice(t(`${id}.status.deleted`));
  };

  return (
    <>
      <section className={styles.header} data-surface="light">
        <p className={styles.eyebrow}>{t(`${id}.eyebrow`)}</p>
        <div className={styles.titleRow}>
          <h1 className={styles.title}>{t(`${id}.title`)}</h1>
          <button
            className={styles.primaryButton}
            type="button"
            onClick={() => setForm({ kind: 'create' })}
            disabled={list.status !== 'ready'}
          >
            <UploadSimpleIcon aria-hidden="true" />
            {t(`${id}.upload`)}
          </button>
        </div>
        <p className={styles.lead}>{t(`${id}.lead`)}</p>
      </section>

      <section className={styles.body} data-surface="light" data-tone="white">
        <p className={styles.notice} role="status">
          {notice}
        </p>

        {list.status === 'loading' && <p className={styles.empty}>{t(`${id}.status.loading`)}</p>}

        {list.status === 'error' && (
          <div className={styles.errorBox} role="alert">
            <p>{t(`${id}.errors.${list.errorKey}`)}</p>
            <button className={styles.secondaryButton} type="button" onClick={retry}>
              <ArrowClockwiseIcon aria-hidden="true" />
              {t(`${id}.status.retry`)}
            </button>
          </div>
        )}

        {list.status === 'ready' &&
          (list.items.length === 0 ? (
            <p className={styles.empty}>{t(`${id}.status.empty`)}</p>
          ) : (
            <>
              <p className={styles.count}>{t(`${id}.count`, { count: list.items.length })}</p>
              <ItemList
                collection={collection}
                items={list.items}
                onEdit={(item) => setForm({ kind: 'edit', item })}
                onDelete={setDeleting}
              />
            </>
          ))}
      </section>

      {form && (
        <ItemFormDialog collection={collection} mode={form} onClose={() => setForm(null)} onSaved={handleSaved} />
      )}
      {deleting && (
        <DeleteItemDialog
          collection={collection}
          item={deleting}
          onClose={() => setDeleting(null)}
          onDeleted={handleDeleted}
        />
      )}
    </>
  );
}

/** Fotoğraf galerisi yönetimi (`/admin-panel/gallery`). */
export function AdminGalleryPage() {
  return <AdminCollectionPage collection={GALLERY_COLLECTION} />;
}

/** Sertifika yönetimi (`/admin-panel/certificates`). */
export function AdminCertificatesPage() {
  return <AdminCollectionPage collection={CERTIFICATES_COLLECTION} />;
}
