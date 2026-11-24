import { zodResolver } from '@hookform/resolvers/zod';
import { ImageSquareIcon } from '@phosphor-icons/react/dist/csr/ImageSquare';
import { WarningCircleIcon } from '@phosphor-icons/react/dist/csr/WarningCircle';
import { type ChangeEvent, type DragEvent, useEffect, useId, useRef, useState } from 'react';
import { type FieldErrors, useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import type { Locale } from '../../../i18n/locale';
import { AdminDialog } from '../AdminDialog';
import { LocaleTabs } from '../LocaleTabs';
import { type AdminPhoto, updatePhoto, uploadPhoto } from './galleryAdminApi';
import { galleryErrorKey } from './galleryErrors';
import styles from './PhotoFormDialog.module.css';
import { MAX_SOURCE_BYTES, prepareImage } from './prepareImage';

// Sınırlar `server/gallery.ts` ile aynıdır.
const TITLE_MAX = 120;
const DESCRIPTION_MAX = 1000;

const localized = (max: number) => z.object({ tr: z.string().trim().max(max), en: z.string().trim().max(max) });
const photoTextSchema = z.object({ title: localized(TITLE_MAX), description: localized(DESCRIPTION_MAX) });
type PhotoTextInput = z.infer<typeof photoTextSchema>;

export type PhotoFormMode = { kind: 'create' } | { kind: 'edit'; photo: AdminPhoto };

type Phase = 'idle' | 'preparing' | 'uploading' | 'saving';

type PhotoFormDialogProps = {
  mode: PhotoFormMode;
  onClose: () => void;
  onSaved: (photo: AdminPhoto) => void;
};

function hasLocaleError(errors: FieldErrors<PhotoTextInput>, locale: Locale) {
  return Boolean(errors.title?.[locale] || errors.description?.[locale]);
}

export function PhotoFormDialog({ mode, onClose, onSaved }: PhotoFormDialogProps) {
  const { t } = useTranslation('admin');
  const formId = useId();
  const isEdit = mode.kind === 'edit';

  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [activeLocale, setActiveLocale] = useState<Locale>('tr');
  const [phase, setPhase] = useState<Phase>('idle');
  const [progress, setProgress] = useState(0);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const isBusy = phase !== 'idle';

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<PhotoTextInput>({
    resolver: zodResolver(photoTextSchema),
    defaultValues: isEdit
      ? { title: { ...mode.photo.title }, description: { ...mode.photo.description } }
      : { title: { tr: '', en: '' }, description: { tr: '', en: '' } },
  });
  const values = useWatch({ control });

  // Önizleme adresi yeni dosya seçilince ve pencere kapanınca serbest bırakılır.
  const previewUrlRef = useRef<string | null>(null);
  useEffect(
    () => () => {
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    },
    [],
  );

  const pickFile = (picked: File | undefined) => {
    if (!picked) return;
    setSubmitError(null);
    if (!picked.type.startsWith('image/')) {
      setFileError(t('gallery.errors.unreadable'));
      return;
    }
    if (picked.size > MAX_SOURCE_BYTES) {
      setFileError(t('gallery.errors.tooLarge'));
      return;
    }
    setFileError(null);
    setFile(picked);
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    previewUrlRef.current = URL.createObjectURL(picked);
    setPreviewUrl(previewUrlRef.current);
  };

  const handleDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setIsDragging(false);
    if (!isBusy) pickFile(event.dataTransfer.files[0]);
  };

  const onSubmit = handleSubmit(
    async (text) => {
      setSubmitError(null);
      try {
        if (isEdit) {
          setPhase('saving');
          onSaved(await updatePhoto(mode.photo.id, text));
          return;
        }
        if (!file) {
          setFileError(t('gallery.form.fileRequired'));
          return;
        }
        setPhase('preparing');
        const image = await prepareImage(file);
        setPhase('uploading');
        setProgress(0);
        const photo = await uploadPhoto(image, text, (ratio) => {
          setProgress(ratio);
          if (ratio >= 1) setPhase('saving');
        });
        onSaved(photo);
      } catch (error) {
        setSubmitError(t(galleryErrorKey(error)));
        setPhase('idle');
      }
    },
    (fieldErrors) => {
      // Hatalı alan diğer sekmedeyse o sekmeye geçilir.
      if (!hasLocaleError(fieldErrors, activeLocale)) {
        const other = activeLocale === 'tr' ? 'en' : 'tr';
        if (hasLocaleError(fieldErrors, other)) setActiveLocale(other);
      }
      if (!isEdit && !file) setFileError(t('gallery.form.fileRequired'));
    },
  );

  const busyLabel = {
    idle: '',
    preparing: t('gallery.form.preparing'),
    uploading: t('gallery.form.uploading', { percent: Math.round(progress * 100) }),
    saving: t('gallery.form.saving'),
  }[phase];

  // Ekran okuyucuya yalnızca aşama değişimi okunur, yüzde her an değiştiği için okunmaz.
  const phaseAnnouncement = {
    idle: '',
    preparing: t('gallery.form.preparing'),
    uploading: t('gallery.form.uploadingStatus'),
    saving: t('gallery.form.saving'),
  }[phase];

  return (
    <AdminDialog
      title={t(isEdit ? 'gallery.form.editTitle' : 'gallery.form.createTitle')}
      closeLabel={t('gallery.form.close')}
      isBusy={isBusy}
      onClose={onClose}
    >
      <form className={styles.form} onSubmit={onSubmit} noValidate aria-busy={isBusy}>
        {isEdit ? (
          <img className={styles.currentImage} src={mode.photo.thumbUrl} alt="" />
        ) : (
          <div className={styles.fileField}>
            <span className={styles.label} id={`${formId}-file-label`}>
              {t('gallery.form.file')}
            </span>
            <label
              className={styles.dropZone}
              data-dragging={isDragging || undefined}
              data-invalid={fileError ? true : undefined}
              onDragOver={(event) => {
                event.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
            >
              <input
                className={styles.fileInput}
                type="file"
                accept="image/*"
                disabled={isBusy}
                aria-labelledby={`${formId}-file-label ${formId}-file-action`}
                aria-describedby={`${formId}-file-hint${fileError ? ` ${formId}-file-error` : ''}`}
                aria-invalid={fileError ? true : undefined}
                onChange={(event: ChangeEvent<HTMLInputElement>) => {
                  pickFile(event.target.files?.[0]);
                  event.target.value = '';
                }}
              />
              {previewUrl ? (
                <img className={styles.preview} src={previewUrl} alt={t('gallery.form.previewAlt')} />
              ) : (
                <ImageSquareIcon className={styles.dropIcon} aria-hidden="true" weight="light" />
              )}
              <span className={styles.dropCopy}>
                <span id={`${formId}-file-action`} className={styles.dropAction}>
                  {t(file ? 'gallery.form.change' : 'gallery.form.choose')}
                </span>
                {file && <span className={styles.fileName}>{file.name}</span>}
                <span id={`${formId}-file-hint`} className={styles.hint}>
                  {t('gallery.form.dropHint')}
                </span>
              </span>
            </label>
            {fileError && (
              <p id={`${formId}-file-error`} className={styles.fieldError}>
                {fileError}
              </p>
            )}
          </div>
        )}

        <LocaleTabs
          label={t('gallery.form.languages')}
          idPrefix={`${formId}-locale`}
          active={activeLocale}
          onChange={setActiveLocale}
          tabLabel={(locale) => t(`gallery.form.tabs.${locale}`)}
          hasError={(locale) => hasLocaleError(errors, locale)}
          errorHint={t('gallery.form.tabHasError')}
          renderPanel={(locale) => {
            const titleId = `${formId}-title-${locale}`;
            const descriptionId = `${formId}-description-${locale}`;
            const titleLength = values.title?.[locale]?.length ?? 0;
            const descriptionLength = values.description?.[locale]?.length ?? 0;
            return (
              <>
                <div className={styles.field}>
                  <div className={styles.labelRow}>
                    <label className={styles.label} htmlFor={titleId}>
                      {t('gallery.form.titleLabel')}{' '}
                      <span className={styles.optional}>({t('gallery.form.optional')})</span>
                    </label>
                    <span className={styles.counter} aria-hidden="true">
                      {titleLength} / {TITLE_MAX}
                    </span>
                  </div>
                  <input
                    id={titleId}
                    className={styles.input}
                    type="text"
                    lang={locale}
                    maxLength={TITLE_MAX}
                    disabled={isBusy}
                    aria-invalid={errors.title?.[locale] ? true : undefined}
                    aria-describedby={errors.title?.[locale] ? `${titleId}-error` : undefined}
                    {...register(`title.${locale}`)}
                  />
                  {errors.title?.[locale] && (
                    <p id={`${titleId}-error`} className={styles.fieldError}>
                      {t('gallery.form.tooLong', { max: TITLE_MAX })}
                    </p>
                  )}
                </div>

                <div className={styles.field}>
                  <div className={styles.labelRow}>
                    <label className={styles.label} htmlFor={descriptionId}>
                      {t('gallery.form.descriptionLabel')}{' '}
                      <span className={styles.optional}>({t('gallery.form.optional')})</span>
                    </label>
                    <span className={styles.counter} aria-hidden="true">
                      {descriptionLength} / {DESCRIPTION_MAX}
                    </span>
                  </div>
                  <textarea
                    id={descriptionId}
                    className={`${styles.input} ${styles.textarea}`}
                    lang={locale}
                    rows={4}
                    maxLength={DESCRIPTION_MAX}
                    disabled={isBusy}
                    aria-invalid={errors.description?.[locale] ? true : undefined}
                    aria-describedby={errors.description?.[locale] ? `${descriptionId}-error` : undefined}
                    {...register(`description.${locale}`)}
                  />
                  {errors.description?.[locale] && (
                    <p id={`${descriptionId}-error`} className={styles.fieldError}>
                      {t('gallery.form.tooLong', { max: DESCRIPTION_MAX })}
                    </p>
                  )}
                </div>
              </>
            );
          }}
        />

        <p className={styles.hint}>{t('gallery.form.textHint')}</p>

        <p className={styles.alert} role="alert">
          {submitError && (
            <>
              <WarningCircleIcon aria-hidden="true" weight="fill" />
              {submitError}
            </>
          )}
        </p>

        {phase === 'uploading' && (
          <progress className={styles.progress} max={1} value={progress} aria-label={busyLabel} />
        )}

        <div className={styles.actions}>
          <button className={styles.secondary} type="button" onClick={onClose} disabled={isBusy}>
            {t('gallery.form.cancel')}
          </button>
          <button className={styles.primary} type="submit" disabled={isBusy}>
            {isBusy ? busyLabel : t(isEdit ? 'gallery.form.submitEdit' : 'gallery.form.submitCreate')}
          </button>
        </div>
        <p className={styles.visuallyHidden} aria-live="polite">
          {phaseAnnouncement}
        </p>
      </form>
    </AdminDialog>
  );
}
