import { type RefObject, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollTrigger, useGSAP } from '../../../animations/gsap';
import { useSmoothScroll } from '../../../hooks/useSmoothScroll';
import styles from './SectionRail.module.css';

// Bir bölüm, üst kenarı ekranın bu yüksekliğine gelince etkin sayılır.
const ACTIVE_LINE_PERCENT = 55;

// Rayın ekranda kapladığı dikey aralığın alt ve üst sınırları.
const SOLID_ENTER_PERCENT = 78;
const SOLID_LEAVE_PERCENT = 22;

function formatNumber(value: number) {
  return String(value).padStart(2, '0');
}

export type SectionRailItem = {
  key: string;
  /** Çevrilmiş kısa bölüm adı. */
  label: string;
};

type SectionRailProps = {
  /** Doğrudan alt öğeleri bölümler olan kapsayıcı. Sıra `items` ile aynı olmalıdır. */
  sequenceRef: RefObject<HTMLElement | null>;
  items: readonly SectionRailItem[];
};

/**
 * Uzun sayfalarda hangi bölümde olunduğunu ve ne kadar kaldığını gösterir, istenen bölüme atlatır.
 * Masaüstünde sağda dikey ray, mobilde ve dikey tablette altta şerittir.
 *
 * Masaüstünde ray zeminin negatifi olarak görünür. Vurgu rengi gibi doygun zeminlerin negatifi
 * palet dışı bir renk verdiği için o bölümler `data-rail-solid` taşır ve ray üstlerinde düz renge geçer.
 * Ray içeriğin üstüne binmesin diye bölümlerin sağında masaüstünde `--rail-width` kadar yer bırakılır.
 */
export function SectionRail({ sequenceRef, items }: SectionRailProps) {
  const { t, i18n } = useTranslation();
  const lenisRef = useSmoothScroll();
  const rootRef = useRef<HTMLElement>(null);
  const triggersRef = useRef<ScrollTrigger[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const [isSolid, setIsSolid] = useState(false);

  // Hareket içermez, hareket azaltma tercihinde de konum bilgisi çalışır.
  useGSAP(
    () => {
      const sequence = sequenceRef.current;
      const root = rootRef.current;
      if (!sequence || !root) return;

      const sections = Array.from(sequence.children);

      const triggers = sections.map((section, index) =>
        ScrollTrigger.create({
          trigger: section,
          start: `top ${ACTIVE_LINE_PERCENT}%`,
          end: 'max',
          onEnter: () => setActiveIndex(index),
          onLeaveBack: () => setActiveIndex(Math.max(index - 1, 0)),
        }),
      );
      triggersRef.current = triggers;

      const visibility = ScrollTrigger.create({
        trigger: sequence,
        start: `top ${ACTIVE_LINE_PERCENT}%`,
        end: `bottom ${ACTIVE_LINE_PERCENT}%`,
        onToggle: (self) => setIsVisible(self.isActive),
      });

      // Doygun bölüm rayın altına girdiği andan bir sonraki bölüm rayı geçene kadar ray düz renkte kalır.
      const solidTriggers: ScrollTrigger[] = [];
      const updateSolid = () => setIsSolid(solidTriggers.some((trigger) => trigger.isActive));

      sections.forEach((section, index) => {
        if (!section.hasAttribute('data-rail-solid')) return;

        const next = sections[index + 1];
        solidTriggers.push(
          ScrollTrigger.create({
            trigger: section,
            start: `top ${SOLID_ENTER_PERCENT}%`,
            endTrigger: next ?? sequence,
            end: next ? `top ${SOLID_LEAVE_PERCENT}%` : `bottom ${ACTIVE_LINE_PERCENT}%`,
            onToggle: updateSolid,
          }),
        );
      });

      ScrollTrigger.create({
        trigger: sequence,
        start: 'top top',
        end: 'bottom bottom',
        onUpdate: (self) => root.style.setProperty('--progress', String(self.progress)),
      });

      // Yapışık bölümlerin konumu ancak sayfa başından doğru ölçülür, dil değişimi sayfanın ortasında olabilir.
      ScrollTrigger.refresh();
      const scroll = window.scrollY;
      setActiveIndex(Math.max(triggers.findLastIndex((trigger) => scroll >= trigger.start), 0));
      setIsVisible(visibility.isActive);
      updateSolid();

      return () => {
        triggersRef.current = [];
      };
    },
    { dependencies: [i18n.language, items.length], revertOnUpdate: true },
  );

  const jumpTo = (index: number) => {
    const trigger = triggersRef.current[index];
    if (!trigger) return;

    const target = trigger.start + (window.innerHeight * ACTIVE_LINE_PERCENT) / 100;
    if (lenisRef.current) lenisRef.current.scrollTo(target, { force: true });
    else window.scrollTo(0, target);
  };

  return (
    <nav
      ref={rootRef}
      className={`${styles.root} ${isVisible ? styles.visible : ''} ${isSolid ? styles.solid : ''}`}
      aria-label={t('sectionRail.label')}
    >
      <p className={styles.counter} aria-hidden="true">
        {formatNumber(activeIndex + 1)}
        <span className={styles.counterTotal}>/{formatNumber(items.length)}</span>
      </p>

      <div className={styles.rail}>
        <ol className={styles.list}>
          {items.map(({ key, label }, index) => {
            const isActive = index === activeIndex;

            return (
              <li key={key}>
                <button
                  className={`${styles.item} ${isActive ? styles.active : ''}`}
                  type="button"
                  aria-label={label}
                  aria-current={isActive ? 'true' : undefined}
                  onClick={() => jumpTo(index)}
                >
                  <span className={styles.label} aria-hidden="true">
                    {label}
                  </span>
                  <span className={styles.number} aria-hidden="true">
                    {formatNumber(index + 1)}
                  </span>
                  <span className={styles.tick} aria-hidden="true" />
                </button>
              </li>
            );
          })}
        </ol>

        <span className={styles.track} aria-hidden="true">
          <span className={styles.fill} />
        </span>
      </div>
    </nav>
  );
}
