import { zodResolver } from '@hookform/resolvers/zod';
import { type ReactNode, useState } from 'react';
import { type DefaultValues, useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { GenericCheckbox } from '../ui/GenericCheckbox/GenericCheckbox';
import { RollArrow, RollText } from '../ui/RollText/RollText';
import styles from './ContactForm.module.css';
import { PrivacyNotice } from './PrivacyNotice';
import { ContactNotConfiguredError, submitContact } from './submitContact';

const TOPICS = ['quote', 'technical', 'project', 'other'] as const;
const MESSAGE_MAX = 2000;

const contactSchema = z.object({
  topic: z.enum(TOPICS),
  name: z.string().trim().min(2).max(100),
  company: z.string().trim().max(120),
  email: z.email().max(200),
  // İsteğe bağlı: boş bırakılabilir, yazılırsa rakam, boşluk, parantez, tire ve baştaki + kabul edilir.
  phone: z
    .string()
    .trim()
    .regex(/^$|^\+?[\d\s()-]{7,20}$/),
  message: z.string().trim().min(10).max(MESSAGE_MAX),
  consent: z.literal(true),
  // Bal küpü alanı: gizlidir, yalnızca botlar doldurur.
  website: z.string(),
});

type ContactInput = z.input<typeof contactSchema>;
type ContactOutput = z.output<typeof contactSchema>;

// Hata mesajı alan altında gösterilen metin alanları.
type TextFieldName = 'name' | 'email' | 'phone' | 'message';

type SendStatus = 'idle' | 'sending' | 'sent' | 'error' | 'unconfigured';

// Konu ve onay boş başlar, seçilmeden gönderilemez.
const DEFAULT_VALUES: DefaultValues<ContactInput> = { name: '', company: '', email: '', phone: '', message: '', website: '' };

type FieldProps = {
  id: string;
  number: string;
  label: string;
  isOptional?: boolean;
  error?: string;
  aside?: ReactNode;
  className?: string;
  children: ReactNode;
};

function Field({ id, number, label, isOptional = false, error, aside, className = '', children }: FieldProps) {
  const { t } = useTranslation('contact');

  return (
    <div className={`${styles.field} ${className}`} data-reveal>
      <div className={styles.labelRow}>
        <label className={styles.label} htmlFor={id}>
          <span className={styles.number} aria-hidden="true">
            {number}
          </span>
          {label}
          {isOptional ? <span className={styles.optional}>({t('form.optional')})</span> : ' *'}
        </label>
        {aside}
      </div>
      <div className={styles.control}>
        {children}
        <span className={styles.line} aria-hidden="true" />
      </div>
      {error && (
        <p id={`${id}-error`} className={styles.error}>
          {error}
        </p>
      )}
    </div>
  );
}

export function ContactForm() {
  const { t, i18n } = useTranslation('contact');
  const [status, setStatus] = useState<SendStatus>('idle');
  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors },
  } = useForm<ContactInput, unknown, ContactOutput>({
    resolver: zodResolver(contactSchema),
    defaultValues: DEFAULT_VALUES,
  });
  const messageLength = useWatch({ control, name: 'message' })?.length ?? 0;

  const onSubmit = async ({ consent: _consent, website, ...values }: ContactOutput) => {
    // Bot doldurduysa gönderilmiş gibi davranılır, hiçbir yere iletilmez.
    if (website) {
      reset();
      setStatus('sent');
      return;
    }

    setStatus('sending');
    try {
      await submitContact({ ...values, language: i18n.language });
      reset();
      setStatus('sent');
    } catch (error) {
      setStatus(error instanceof ContactNotConfiguredError ? 'unconfigured' : 'error');
    }
  };

  const describe = (id: string, hasError: boolean) => ({
    'aria-invalid': hasError,
    'aria-describedby': hasError ? `${id}-error` : undefined,
  });

  const fieldError = (name: TextFieldName) => errors[name] && t(`form.errors.${name}` as const);

  return (
    <section className={styles.section} data-surface="light" data-tone="white">
      <div className={styles.intro}>
        <h2 key={i18n.language} className={styles.title} data-reveal-words>
          {t('form.title')}
        </h2>
        <p className={styles.lead} data-reveal>
          {t('form.lead')}
        </p>
        <p className={styles.note} data-reveal>
          {t('form.requiredNote')}
        </p>
      </div>

      <form className={styles.form} onSubmit={handleSubmit(onSubmit)} noValidate>
        <fieldset className={styles.topics} data-reveal {...describe('contact-topic', Boolean(errors.topic))}>
          <legend className={styles.label}>
            <span className={styles.number} aria-hidden="true">
              01
            </span>
            {t('form.topic.legend')} *
          </legend>
          <div className={styles.chips}>
            {TOPICS.map((topic) => (
              <label key={topic} className={styles.chip}>
                <input className={styles.chipInput} type="radio" value={topic} {...register('topic')} />
                <span className={styles.chipText}>{t(`form.topic.options.${topic}`)}</span>
              </label>
            ))}
          </div>
          {errors.topic && (
            <p id="contact-topic-error" className={styles.error}>
              {t('form.errors.topic')}
            </p>
          )}
        </fieldset>

        <div className={styles.pair}>
          <Field id="contact-name" number="02" label={t('form.fields.name')} error={fieldError('name')}>
            <input
              id="contact-name"
              className={styles.input}
              type="text"
              autoComplete="name"
              {...describe('contact-name', Boolean(errors.name))}
              {...register('name')}
            />
          </Field>

          <Field id="contact-company" number="03" label={t('form.fields.company')} isOptional>
            <input
              id="contact-company"
              className={styles.input}
              type="text"
              autoComplete="organization"
              {...register('company')}
            />
          </Field>
        </div>

        <div className={styles.pair}>
          <Field id="contact-email" number="04" label={t('form.fields.email')} error={fieldError('email')}>
            <input
              id="contact-email"
              className={styles.input}
              type="email"
              autoComplete="email"
              {...describe('contact-email', Boolean(errors.email))}
              {...register('email')}
            />
          </Field>

          <Field id="contact-phone" number="05" label={t('form.fields.phone')} isOptional error={fieldError('phone')}>
            <input
              id="contact-phone"
              className={styles.input}
              type="tel"
              autoComplete="tel"
              {...describe('contact-phone', Boolean(errors.phone))}
              {...register('phone')}
            />
          </Field>
        </div>

        <Field
          id="contact-message"
          number="06"
          label={t('form.fields.message')}
          error={fieldError('message')}
          aside={
            <span className={styles.counter} aria-hidden="true">
              {t('form.messageCount', {
                count: messageLength.toLocaleString(i18n.language),
                max: MESSAGE_MAX.toLocaleString(i18n.language),
              })}
            </span>
          }
        >
          <textarea
            id="contact-message"
            className={styles.input}
            rows={4}
            maxLength={MESSAGE_MAX}
            data-lenis-prevent
            {...describe('contact-message', Boolean(errors.message))}
            {...register('message')}
          />
        </Field>

        <div className={styles.consent} data-reveal>
          <GenericCheckbox
            className={styles.consentBox}
            label={t('form.consent.label')}
            description={t('form.consent.description')}
            {...describe('contact-consent', Boolean(errors.consent))}
            {...register('consent')}
          />
          <details className={styles.notice}>
            <summary className={styles.noticeSummary}>{t('form.consent.more')}</summary>
            <PrivacyNotice />
          </details>
          {errors.consent && (
            <p id="contact-consent-error" className={styles.error}>
              {t('form.errors.consent')}
            </p>
          )}
        </div>

        <div className={styles.trap} aria-hidden="true">
          <input type="text" tabIndex={-1} autoComplete="off" {...register('website')} />
        </div>

        <div data-reveal>
          <button className={styles.submit} type="submit" disabled={status === 'sending'}>
            <RollText
              text={t(status === 'sending' ? 'form.sending' : 'form.submit').toLocaleUpperCase(i18n.language)}
            />
            <RollArrow />
          </button>
          <p className={styles.status} role="status">
            {status === 'idle' || status === 'sending' ? '' : t(`form.status.${status}`)}
          </p>
        </div>
      </form>
    </section>
  );
}
