import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { gsap, MOTION, SplitText, useGSAP } from '../../animations/gsap';
import { getPageIntroDelay } from '../../animations/pageIntro';
import { COMPANY, MAP_DIRECTIONS_URL, toEmailHref, toPhoneHref } from '../../content/company';
import { usePrefersReducedMotion } from '../../hooks/useDevice';
import { useOfficeHours } from '../../hooks/useOfficeHours';
import { RollArrow, RollText } from '../ui/RollText/RollText';
import { type ContactCardKind, ContactCardIcon } from './ContactCardIcon';
import styles from './ContactLines.module.css';

// "Kopyalandı" yazısının ekranda kalma süresi.
const COPIED_MS = 2000;

/** Kart içindeki tek bağlantı: bir numara, bir e-posta adresi... */
type Entry = {
  key: string;
  value: string;
  /** Çok satırlı değer (tam adres). Verilirse değer satır satır ve kaydırılabilir yazılır. */
  lines?: readonly string[];
  href: string;
  /** Panoya kopyalanacak değer. Yoksa kopyala düğmesi yerine ok gösterilir. */
  copyValue?: string;
  isExternal?: boolean;
};

type Card = { key: ContactCardKind; label: string; entries: Entry[] };

/** Kopyala ikonu: üst üste iki köşeli sayfa. Kopyalanınca yerini onay işareti alır. */
function CopyIcon({ isCopied }: { isCopied: boolean }) {
  return (
    <span className={styles.copyIcon} data-copied={isCopied || undefined} aria-hidden="true">
      <svg className={styles.copyGlyph} viewBox="0 0 24 24" fill="none">
        <path d="M8 8h12v12H8z" stroke="currentColor" strokeWidth="1.75" />
        <path d="M16 8V4H4v12h4" stroke="currentColor" strokeWidth="1.75" />
      </svg>
      <svg className={styles.checkGlyph} viewBox="0 0 24 24" fill="none">
        <path d="m4.5 12.5 5 5 10-11" stroke="currentColor" strokeWidth="2" />
      </svg>
    </span>
  );
}

function formatNumber(index: number) {
  return String(index + 1).padStart(2, '0');
}

/** Panoya kopyalar, kısa süre "Kopyalandı" durumunu tutar. Pano API'si yoksa (güvensiz bağlam) düğme gösterilmez. */
function useCopy() {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  // Sunucuda çalışmayan bir SPA olduğu için doğrudan okunabilir.
  const canCopy = typeof navigator.clipboard?.writeText === 'function';

  useEffect(() => {
    if (!copiedKey) return;
    const timer = window.setTimeout(() => setCopiedKey(null), COPIED_MS);
    return () => window.clearTimeout(timer);
  }, [copiedKey]);

  const copy = (key: string, value: string) => {
    navigator.clipboard.writeText(value).then(
      () => setCopiedKey(key),
      () => undefined,
    );
  };

  return { canCopy, copiedKey, copy };
}

/** Sayfanın ilk bölümü: büyük başlık, telefon, e-posta, adres ve sosyal medya kartları, canlı açık/kapalı durumu. */
export function ContactLines() {
  const { t, i18n } = useTranslation('contact');
  const prefersReducedMotion = usePrefersReducedMotion();
  const { isOpen, today, time } = useOfficeHours();
  const { canCopy, copiedKey, copy } = useCopy();
  const rootRef = useRef<HTMLElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);

  // Kartlar firma bilgilerinden üretilir: telefon veya e-posta eklenince ilgili kartta yeni satır olarak görünür.
  const cards: Card[] = [
    {
      key: 'phone',
      label: t('company.labels.phone', { ns: 'common' }),
      entries: COMPANY.phones.map((number) => ({
        key: `phone-${number}`,
        value: number,
        href: toPhoneHref(number),
        copyValue: number,
      })),
    },
    {
      key: 'email',
      label: t('company.labels.email', { ns: 'common' }),
      entries: COMPANY.emails.map((email) => ({
        key: `email-${email}`,
        value: email,
        href: toEmailHref(email),
        copyValue: email,
      })),
    },
    {
      key: 'address',
      label: t('company.labels.address', { ns: 'common' }),
      entries: [
        {
          key: 'address',
          value: COMPANY.address.lines.join(', '),
          lines: COMPANY.address.lines,
          href: MAP_DIRECTIONS_URL,
          isExternal: true,
        },
      ],
    },
    {
      key: 'linkedin',
      label: t('company.labels.linkedin', { ns: 'common' }),
      entries: [
        { key: 'linkedin', value: t('lines.linkedinValue'), href: COMPANY.social.linkedin, isExternal: true },
      ],
    },
  ];
  const copiedEntry = cards.flatMap(({ entries }) => entries).find((entry) => entry.key === copiedKey);

  // Başlık tek satırdır ve bölümün genişliğine sığar: metnin em cinsinden genişliği ölçülür, CSS yazı boyutunu
  // genişliğe göre buna böler. Dil değişince ve font inince yeniden ölçülür.
  useLayoutEffect(() => {
    const root = rootRef.current;
    const heading = titleRef.current;
    if (!root || !heading) return;

    let isCancelled = false;
    const measure = () => {
      if (isCancelled) return;
      const range = document.createRange();
      range.selectNodeContents(heading);
      const fontSize = Number.parseFloat(getComputedStyle(heading).fontSize);
      const width = range.getBoundingClientRect().width;
      if (fontSize > 0 && width > 0) root.style.setProperty('--title-em', String(width / fontSize));
    };

    measure();
    document.fonts.ready.then(measure, () => undefined);

    return () => {
      isCancelled = true;
    };
  }, [i18n.language]);

  // Bölüm hero'nun hemen altında, ilk ekranda görünür: scroll yerine perde kalkınca açılır. Dil değişince başlık
  // yeniden bölünür.
  useGSAP(
    () => {
      if (prefersReducedMotion || !titleRef.current) return;

      const delay = getPageIntroDelay() + 0.15;
      SplitText.create(titleRef.current, {
        type: 'words',
        mask: 'words',
        autoSplit: true,
        onSplit: (self) =>
          gsap.from(self.words, {
            yPercent: 130,
            duration: MOTION.slow,
            ease: MOTION.ease,
            stagger: MOTION.stagger,
            delay,
          }),
      });
    },
    { scope: rootRef, dependencies: [i18n.language, prefersReducedMotion], revertOnUpdate: true },
  );

  // Kartlar sırayla aşağıdan gelir.
  useGSAP(
    () => {
      if (prefersReducedMotion) return;

      gsap.from('[data-line-content]', {
        y: 32,
        autoAlpha: 0,
        duration: MOTION.slow,
        ease: MOTION.ease,
        stagger: MOTION.stagger * 2,
        delay: getPageIntroDelay() + 0.3,
      });
    },
    { scope: rootRef, dependencies: [prefersReducedMotion] },
  );

  return (
    <section ref={rootRef} className={styles.section} data-surface="light">
      <div className={styles.top} data-line-content>
        <p className={styles.status}>
          <span className={`${styles.dot} ${isOpen ? styles.dotOpen : ''}`} aria-hidden="true" />
          <span className={styles.statusText}>{t(isOpen ? 'lines.status.open' : 'lines.status.closed')}</span>
          <span className={styles.hours}>
            {today ? t('lines.today', { open: today.open, close: today.close }) : t('lines.todayClosed')}
          </span>
        </p>
      </div>

      {/* SplitText DOM'u değiştirdiği için dil değişince React temiz bir eleman kurar. */}
      <h2 key={i18n.language} ref={titleRef} className={styles.title}>
        {t('lines.title')}
      </h2>

      <ul className={styles.list}>
        {cards.map(({ key, label, entries }, index) => (
          <li key={key} className={styles.card} data-line-content>
            <ContactCardIcon kind={key} className={styles.cardIcon} />
            <div className={styles.head}>
              <span className={styles.number} aria-hidden="true">
                {formatNumber(index)}
              </span>
              <h3 className={styles.label}>{label}</h3>
            </div>

            <ul className={styles.entries}>
              {entries.map(({ key: entryKey, value, lines, href, copyValue, isExternal }) => {
                const hasCopy = canCopy && copyValue !== undefined;
                return (
                  <li key={entryKey} className={styles.entry}>
                    <a
                      className={styles.entryLink}
                      href={href}
                      {...(isExternal ? { target: '_blank', rel: 'noreferrer' } : {})}
                    >
                      {lines ? (
                        <span className={styles.lines}>
                          {lines.map((line) => (
                            <span key={line}>{line}</span>
                          ))}
                        </span>
                      ) : (
                        <RollText className={styles.value} text={value} />
                      )}
                      {/* Değerin sağındaki yer: kopyalanabilen girdilerde düğme bunun üstüne biner, diğerlerinde ok
                          durur. */}
                      <span className={styles.trail} aria-hidden="true">
                        {!hasCopy && <RollArrow />}
                      </span>
                    </a>
                    {hasCopy && (
                      <button
                        className={styles.copy}
                        type="button"
                        aria-label={t('lines.copyLabel', { value })}
                        onClick={() => copy(entryKey, copyValue)}
                      >
                        <CopyIcon isCopied={copiedKey === entryKey} />
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </li>
        ))}
      </ul>

      <p className={styles.clock} data-line-content>
        {t('lines.clock', { time })}
      </p>

      <p className={styles.srOnly} role="status">
        {copiedEntry ? t('lines.copiedAnnounce', { value: copiedEntry.value }) : ''}
      </p>
    </section>
  );
}
