import { zodResolver } from '@hookform/resolvers/zod';
import { EyeIcon } from '@phosphor-icons/react/dist/csr/Eye';
import { EyeSlashIcon } from '@phosphor-icons/react/dist/csr/EyeSlash';
import { WarningCircleIcon } from '@phosphor-icons/react/dist/csr/WarningCircle';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { DEFAULT_PAGE_HERO_IMAGE } from '../../content/pageHeroImages';
import { AdminApiError, type AdminApiErrorCode, type AdminUser, loginAdmin } from './adminApi';
import styles from './AdminLogin.module.css';

// Sayfa başlığı bantlarındaki varsayılan görsel (`src/content/pageHeroImages.ts`).
const BACKDROP_SRC = DEFAULT_PAGE_HERO_IMAGE.src;

const loginSchema = z.object({
  email: z.email().max(256),
  password: z.string().min(1).max(256),
});

type LoginInput = z.infer<typeof loginSchema>;

function serverErrorKey(code: AdminApiErrorCode) {
  if (code === 'invalid_credentials' || code === 'unauthorized') return 'login.errors.invalidCredentials';
  if (code === 'not_configured') return 'login.errors.notConfigured';
  return 'login.errors.unknown';
}

type AdminLoginProps = {
  onSuccess: (user: AdminUser) => void;
};

export function AdminLogin({ onSuccess }: AdminLoginProps) {
  const { t } = useTranslation('admin');
  const [serverError, setServerError] = useState<AdminApiErrorCode | null>(null);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);

  const {
    register,
    handleSubmit,
    setFocus,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  useEffect(() => {
    setFocus('email');
  }, [setFocus]);

  const onSubmit = handleSubmit(async ({ email, password }) => {
    setServerError(null);
    try {
      onSuccess(await loginAdmin(email, password));
    } catch (error) {
      setServerError(error instanceof AdminApiError ? error.code : 'unknown');
      setFocus('password');
    }
  });

  return (
    <div className={styles.page}>
      <section className={styles.intro} data-surface="dark" aria-labelledby="admin-login-title">
        {/* Dekoratif zemin görseli: başlık okunur kalsın diye üstünde koyu bir perde durur. */}
        <img className={styles.backdrop} src={BACKDROP_SRC} width={2560} height={667} alt="" decoding="async" />
        <img className={styles.logo} src="/sirket-logosu-dark.png" width={300} height={108} alt={t('brand.logoAlt')} />
        <div className={styles.introCopy}>
          <p className={styles.eyebrow}>{t('login.eyebrow')}</p>
          <h1 id="admin-login-title" className={styles.title}>
            {t('login.title')}
          </h1>
        </div>
      </section>

      <section className={styles.formSection} data-surface="light" data-tone="white">
        <form className={styles.form} onSubmit={onSubmit} noValidate>
          <p className={styles.lead}>{t('login.lead')}</p>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="admin-email">
              {t('login.email')}
            </label>
            <input
              id="admin-email"
              className={styles.input}
              type="email"
              autoComplete="username"
              inputMode="email"
              spellCheck={false}
              aria-invalid={errors.email ? true : undefined}
              aria-describedby={errors.email ? 'admin-email-error' : undefined}
              {...register('email')}
            />
            {errors.email && (
              <p id="admin-email-error" className={styles.fieldError}>
                {t('login.errors.email')}
              </p>
            )}
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="admin-password">
              {t('login.password')}
            </label>
            <div className={styles.passwordControl}>
              <input
                id="admin-password"
                className={styles.input}
                type={isPasswordVisible ? 'text' : 'password'}
                autoComplete="current-password"
                aria-invalid={errors.password ? true : undefined}
                aria-describedby={errors.password ? 'admin-password-error' : undefined}
                {...register('password')}
              />
              <button
                type="button"
                className={styles.reveal}
                aria-label={t(isPasswordVisible ? 'login.hidePassword' : 'login.showPassword')}
                aria-pressed={isPasswordVisible}
                onClick={() => setIsPasswordVisible((visible) => !visible)}
              >
                {isPasswordVisible ? <EyeSlashIcon aria-hidden="true" /> : <EyeIcon aria-hidden="true" />}
              </button>
            </div>
            {errors.password && (
              <p id="admin-password-error" className={styles.fieldError}>
                {t('login.errors.password')}
              </p>
            )}
          </div>

          <p className={styles.alert} role="alert">
            {serverError && (
              <>
                <WarningCircleIcon aria-hidden="true" weight="fill" />
                {t(serverErrorKey(serverError))}
              </>
            )}
          </p>

          <button type="submit" className={styles.submit} disabled={isSubmitting}>
            {t(isSubmitting ? 'login.submitting' : 'login.submit')}
          </button>
        </form>
      </section>
    </div>
  );
}
