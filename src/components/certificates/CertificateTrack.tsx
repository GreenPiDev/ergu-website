import type Lenis from 'lenis';
import { type RefObject, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { gsap, MOTION, ScrollTrigger, useGSAP } from '../../animations/gsap';
import { getPageIntroDelay } from '../../animations/pageIntro';
import { useHasFinePointer, usePrefersReducedMotion } from '../../hooks/useDevice';
import { useSmoothScroll } from '../../hooks/useSmoothScroll';
import { Lightbox } from '../ui/Lightbox/Lightbox';
import { RollArrow, RollText } from '../ui/RollText/RollText';
import { type Certificate, localizedText } from './certificatesApi';
import styles from './CertificateTrack.module.css';

// Kart sığmazken bilgi sütunu bu adımlarla, bölüm genişliğinin en fazla bu oranına kadar genişler.
const INFO_WIDTH_STEP = 24;
const MAX_INFO_WIDTH_RATIO = 0.45;
// Dik düzende görsel bundan küçük olmaz; ekran bu kadar bile yer bırakmıyorsa bölüm uzar.
const MIN_STACKED_IMAGE_HEIGHT = 160;

type CertificateTrackProps = {
  certificates: Certificate[];
  /** Sabitlenecek kapsayıcı: hero ve bu bölüm birlikte. Kaydırırken hero da yerinde kalır. */
  pinRef: RefObject<HTMLElement | null>;
};

/**
 * Belgeler yatay bir şeritte yan yana kartlar olarak dizilir. Bölüm hero'nun altındaki ekranı doldurur, sayfa dikey
 * kaymaz. Kartların yüksekliği en uzun açıklamaya göre belirlenir, metin kartın içinde kaymaz:
 *
 * - Fareli cihazlarda hero ile birlikte sabitlenir; aşağı kaydırma ve trackpad'in sağa hareketi şeridi sağa, yukarı
 *   ve sola hareket sola götürür (Lenis bu sayfada iki yönü de dikey kaydırmaya çevirir, ScrollTrigger şeridi
 *   kaydırmaya bağlar).
 * - Dokunmatik cihazlarda şerit doğal yatay kaydırmayla, kart kart oturarak gezilir.
 */
export function CertificateTrack({ certificates, pinRef }: CertificateTrackProps) {
  const { t, i18n } = useTranslation('certificates');
  const hasFinePointer = useHasFinePointer();
  const prefersReducedMotion = usePrefersReducedMotion();
  const lenisRef = useSmoothScroll();
  const sectionRef = useRef<HTMLElement>(null);
  const trackRef = useRef<HTMLOListElement>(null);
  const progressRef = useRef<HTMLSpanElement>(null);
  const footerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<ScrollTrigger | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const isPinned = hasFinePointer;

  const numberFormat = new Intl.NumberFormat(i18n.language, { minimumIntegerDigits: 2 });
  const items = certificates.map((certificate, index) => {
    const number = numberFormat.format(index + 1);
    const title = localizedText(certificate.title, i18n.language);
    return {
      certificate,
      number,
      name: title || t('untitled', { number }),
      description: localizedText(certificate.description, i18n.language),
    };
  });
  const lastIndex = items.length - 1;

  const showProgress = (progress: number) => {
    gsap.set(progressRef.current, { scaleX: progress });
    setCurrentIndex(Math.round(progress * lastIndex));
  };

  // Trackpad'in yatay hareketi de sayfayı kaydırsın. Lenis sağlayıcıda bu bileşenden sonra kurulduğu için bir kare
  // beklenir. Lenis yoksa (azaltılmış hareket) yatay hareket elle dikey kaydırmaya çevrilir; ikisinde de tarayıcının
  // geri/ileri kaydırma hareketi tetiklenmez.
  useEffect(() => {
    if (!isPinned) return;

    // Yalnızca burada ayarlanan örnek geri alınır; Lenis arada yeniden kurulduysa yenisine dokunulmaz.
    let configured: Lenis | null = null;
    const frame = requestAnimationFrame(() => {
      configured = lenisRef.current;
      if (configured) configured.options.gestureOrientation = 'both';
    });
    const handleWheel = (event: WheelEvent) => {
      if (lenisRef.current || Math.abs(event.deltaX) <= Math.abs(event.deltaY)) return;
      event.preventDefault();
      window.scrollBy(0, event.deltaX);
    };
    window.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('wheel', handleWheel);
      if (configured) configured.options.gestureOrientation = 'vertical';
    };
  }, [isPinned, lenisRef]);

  // Kartların yüksekliği en uzun metne göre belirlenir: bilgi sütunlarının doğal yükseklikleri ölçülür, hepsi en
  // uzununa eşitlenir, belge görseli de bu yüksekliğe uyar. Kart, hero ile alttaki ilerleme satırı arasındaki alana
  // sığmalıdır:
  // - Yan yana düzende sığmazsa bilgi sütunu adım adım genişler, metin daha az satıra iner ve kart kısalır.
  // - Dik düzende (bilgiler görselin altında) görsel kalan yüksekliğe göre küçülür.
  // Ekran boyutu, font ve dil değişince yeniden ölçülür. Kart genişliği değişebileceği için ScrollTrigger yenilenir.
  useLayoutEffect(() => {
    const section = sectionRef.current;
    const track = trackRef.current;
    if (!section || !track) return;

    const px = (value: string) => Number.parseFloat(value) || 0;
    let lastKey: string | null = null;

    const measure = () => {
      const cards = Array.from(track.querySelectorAll<HTMLElement>('[data-card]'));
      const infos = cards
        .map((card) => card.querySelector<HTMLElement>('[data-card-info]'))
        .filter((info): info is HTMLElement => info !== null);
      if (cards.length === 0 || infos.length === 0) return;

      // Kartlara kalan yükseklik: ekrandan hero, bölüm boşlukları ve ilerleme satırı düşülür.
      const sectionStyle = getComputedStyle(section);
      const hero = section.previousElementSibling;
      const available =
        window.innerHeight -
        (hero instanceof HTMLElement ? hero.offsetHeight : 0) -
        px(sectionStyle.paddingTop) -
        px(sectionStyle.paddingBottom) -
        px(sectionStyle.rowGap) -
        (footerRef.current?.offsetHeight ?? 0);

      track.style.removeProperty('--certificate-info-width');
      track.style.removeProperty('--certificate-stacked-image-height');
      const cardStyle = getComputedStyle(cards[0]);
      const padding = px(cardStyle.paddingTop) + px(cardStyle.paddingBottom);
      const isStacked = cardStyle.flexDirection === 'column';

      // Sütun karta yayılmasın diye ölçüm anında kendi içeriği kadar bırakılır.
      const tallestInfo = () => {
        infos.forEach((info) => (isStacked ? (info.style.flex = 'none') : (info.style.alignSelf = 'flex-start')));
        const tallest = Math.max(...infos.map((info) => info.offsetHeight));
        infos.forEach((info) => (isStacked ? (info.style.flex = '') : (info.style.alignSelf = '')));
        return tallest;
      };

      let key: string;
      if (isStacked) {
        const media = cards[0].querySelector<HTMLElement>('[data-card-media]');
        const imageHeight = media?.offsetHeight ?? 0;
        const room = available - padding - px(cardStyle.rowGap) - tallestInfo();
        const fitted = Math.max(MIN_STACKED_IMAGE_HEIGHT, Math.min(imageHeight, Math.floor(room)));
        if (fitted < imageHeight) track.style.setProperty('--certificate-stacked-image-height', `${fitted}px`);
        track.style.removeProperty('--certificate-card-height');
        key = `stacked:${fitted}`;
      } else {
        let width = infos[0].offsetWidth;
        const maxWidth = Math.max(width, section.clientWidth * MAX_INFO_WIDTH_RATIO);
        let tallest = tallestInfo();
        while (tallest + padding > available && width < maxWidth) {
          width = Math.min(maxWidth, width + INFO_WIDTH_STEP);
          track.style.setProperty('--certificate-info-width', `${width}px`);
          tallest = tallestInfo();
        }
        const height = Math.ceil(tallest + padding);
        track.style.setProperty('--certificate-card-height', `${height}px`);
        key = `row:${height}:${width}`;
      }

      if (key === lastKey) return;
      lastKey = key;
      ScrollTrigger.refresh();
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(section);
    void document.fonts.ready.then(measure);
    return () => observer.disconnect();
  }, [items.length, i18n.language]);

  // Sabitlenen bölüm: dikey kaydırma mesafesi şeridin taşan genişliği kadardır.
  useGSAP(
    () => {
      const section = sectionRef.current;
      const track = trackRef.current;
      const pinTarget = pinRef.current;
      if (!isPinned || !section || !track || !pinTarget) return;

      const distance = () => Math.max(0, track.scrollWidth - section.clientWidth);
      const tween = gsap.to(track, {
        x: () => -distance(),
        ease: 'none',
        scrollTrigger: {
          // Hero ve şerit birlikte ekranı doldurur: sayfa açılır açılmaz ikisi birden sabitlenir. Kaydırma yalnızca
          // şeridi hareket ettirir.
          trigger: pinTarget,
          start: 'top top',
          end: () => `+=${distance()}`,
          pin: pinTarget,
          scrub: true,
          invalidateOnRefresh: true,
          onUpdate: (self) => showProgress(self.progress),
        },
      });
      triggerRef.current = tween.scrollTrigger ?? null;

      return () => {
        triggerRef.current = null;
      };
    },
    { scope: sectionRef, dependencies: [isPinned, items.length, i18n.language], revertOnUpdate: true },
  );

  // Kartlar perde kalkarken sağdan sırayla gelir.
  useGSAP(
    () => {
      if (prefersReducedMotion) return;
      gsap.from('[data-card]', {
        x: 120,
        autoAlpha: 0,
        duration: MOTION.slow,
        ease: MOTION.ease,
        stagger: MOTION.stagger * 2,
        delay: getPageIntroDelay(),
      });
    },
    { scope: sectionRef, dependencies: [prefersReducedMotion] },
  );

  // Doğal kaydırmada ilerleme şeridin kendi kaydırmasından okunur.
  const handleNativeScroll = () => {
    const track = trackRef.current;
    const section = sectionRef.current;
    if (isPinned || !track || !section) return;
    const max = track.scrollWidth - track.clientWidth;
    showProgress(max > 0 ? track.scrollLeft / max : 0);
  };

  // Sabitlenmiş şeritte klavyeyle odaklanan kart görünür olsun diye sayfa o kartın konumuna kaydırılır.
  const revealCard = (card: HTMLElement) => {
    const trigger = triggerRef.current;
    const section = sectionRef.current;
    if (!isPinned || !trigger || !section) return;
    const cardEnd = card.offsetLeft + card.offsetWidth;
    const viewStart = -Number(gsap.getProperty(trackRef.current, 'x'));
    const viewEnd = viewStart + section.clientWidth;
    if (card.offsetLeft >= viewStart && cardEnd <= viewEnd) return;
    const offset = Math.min(Math.max(0, card.offsetLeft - section.clientWidth * 0.1), trigger.end - trigger.start);
    const target = trigger.start + offset;
    if (lenisRef.current) lenisRef.current.scrollTo(target, { duration: MOTION.slow });
    else window.scrollTo({ top: target });
  };

  const opened = openIndex === null ? null : items[openIndex];

  return (
    <section
      ref={sectionRef}
      className={styles.section}
      data-surface="light"
      data-mode={isPinned ? 'pinned' : 'native'}
      aria-label={t('listLabel')}
    >
      <ol ref={trackRef} className={styles.track} onScroll={handleNativeScroll}>
        {items.map(({ certificate, number, name, description }, index) => (
          <li
            key={certificate.id}
            className={styles.card}
            data-card
            onFocus={(event) => revealCard(event.currentTarget)}
          >
            <div className={styles.media} data-card-media>
              <img
                className={styles.image}
                src={certificate.thumbUrl}
                width={certificate.width}
                height={certificate.height}
                alt=""
                loading={index < 4 ? 'eager' : 'lazy'}
                decoding="async"
              />
            </div>
            <div className={styles.info} data-card-info>
              <span className={styles.number} aria-hidden="true">
                {number}
              </span>
              <div className={styles.copy}>
                <h2 className={styles.title}>{name}</h2>
                {description && <p className={styles.description}>{description}</p>}
              </div>
              <button
                className={styles.open}
                type="button"
                aria-label={t('viewLabel', { name })}
                onClick={() => setOpenIndex(index)}
              >
                <RollText text={t('view').toLocaleUpperCase(i18n.language)} />
                <RollArrow />
              </button>
            </div>
            <span className={styles.line} aria-hidden="true" />
          </li>
        ))}
      </ol>

      <div ref={footerRef} className={styles.footer} aria-hidden="true">
        <span className={styles.counter}>
          <span className={styles.current}>{items[currentIndex]?.number}</span>
          <span className={styles.total}>/{numberFormat.format(items.length)}</span>
        </span>
        <span className={styles.bar}>
          <span ref={progressRef} className={styles.progress} />
        </span>
      </div>

      {opened && <Lightbox src={opened.certificate.url} alt={opened.name} onClose={() => setOpenIndex(null)} />}
    </section>
  );
}
