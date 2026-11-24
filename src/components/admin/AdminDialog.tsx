import { XIcon } from '@phosphor-icons/react/dist/csr/X';
import { type ReactNode, useEffect, useId, useRef } from 'react';
import styles from './AdminDialog.module.css';

type AdminDialogProps = {
  title: string;
  closeLabel: string;
  /** İşlem sürerken Escape, dış tıklama ve kapat düğmesi pencereyi kapatmaz. */
  isBusy?: boolean;
  size?: 'small' | 'large';
  onClose: () => void;
  children: ReactNode;
};

/**
 * Panelin modal penceresi. Yerel `dialog` kullanılır: odak tuzağı, Escape ve arka planın erişilemez olması
 * tarayıcıdan gelir. Bileşen bağlanınca açılır, kapatmak için üst bileşen onu kaldırır.
 */
export function AdminDialog({
  title,
  closeLabel,
  isBusy = false,
  size = 'large',
  onClose,
  children,
}: AdminDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    dialog.showModal();
    return () => dialog.close();
  }, []);

  const requestClose = () => {
    if (!isBusy) onClose();
  };

  return (
    <dialog
      ref={dialogRef}
      className={`${styles.dialog} ${size === 'small' ? styles.small : ''}`}
      aria-labelledby={titleId}
      data-surface="light"
      data-tone="white"
      onCancel={(event) => {
        // Escape: pencereyi tarayıcı değil, üst bileşen kapatır.
        event.preventDefault();
        requestClose();
      }}
      onClick={(event) => {
        // Arka plana (pencerenin dışına) tıklayınca kapanır.
        if (event.target === event.currentTarget) requestClose();
      }}
    >
      <div className={styles.inner}>
        <header className={styles.header}>
          <h2 id={titleId} className={styles.title}>
            {title}
          </h2>
          <button
            className={styles.close}
            type="button"
            aria-label={closeLabel}
            onClick={requestClose}
            disabled={isBusy}
          >
            <XIcon aria-hidden="true" />
          </button>
        </header>
        {children}
      </div>
    </dialog>
  );
}
