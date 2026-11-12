import { type MouseEvent, type ReactNode, useLayoutEffect, useRef, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import {
  KNOWLEDGE_IMAGES,
  type KnowledgeImageNumber,
  type KnowledgeImageSize,
  EXTERNAL_LINKS,
} from '../../content/knowledge';
import { Lightbox } from '../ui/Lightbox/Lightbox';
import { InlineLinkArrow } from '../ui/RollText/RollText';
import styles from './Chapter.module.css';
import { useEntryJump, useKnowledge } from './knowledgeHooks';

function ExternalLink({ href, children }: { href: string; children?: ReactNode }) {
  const { t } = useTranslation('knowledge');

  return (
    <a className={styles.link} href={href} target="_blank" rel="noreferrer">
      {children}
      <InlineLinkArrow />
      <span className={styles.srOnly}> ({t('common.newTab')})</span>
    </a>
  );
}

const LINK_COMPONENTS = Object.fromEntries(
  Object.entries(EXTERNAL_LINKS).map(([tag, href]) => [tag, <ExternalLink key={tag} href={href} />]),
);

/** Çeviri metnindeki `<docs>...</docs>` gibi etiketleri `EXTERNAL_LINKS` içindeki dış bağlantıya çevirir. */
export function RichText({ text }: { text: string }) {
  if (!text.includes('<')) return text;
  return <Trans ns="knowledge" defaults={text} components={LINK_COMPONENTS} />;
}

type EntryLinkProps = {
  slug: string;
  className?: string;
  onNavigate?: () => void;
  children: ReactNode;
};

/** Sayfa içi madde bağlantısı. Sağ tıkla kopyalanabilen gerçek bir adresi vardır. */
export function EntryLink({ slug, className, onNavigate, children }: EntryLinkProps) {
  const jump = useEntryJump();

  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    onNavigate?.();
    jump(slug);
  };

  return (
    <a className={className} href={`#${slug}`} onClick={handleClick}>
      {children}
    </a>
  );
}

const MAX_FIT_STEPS = 12;
const FIT_TOLERANCE_PX = 0.5;

/**
 * Görsel genişliği metnin yüksekliğine, metnin yüksekliği de kalan genişliğe bağlıdır.
 * Sıfırdan başlayıp ölçerek ilerleyen genişlik, metnin kalan alanın tamamını kullandığı noktada durur.
 */
function fitLeadRow(row: HTMLElement, imageRatio: number) {
  const style = getComputedStyle(row);

  if (style.getPropertyValue('--lead-fit').trim() !== '1') {
    row.style.removeProperty('--image-width');
    return;
  }

  const lead = row.firstElementChild;
  if (!lead) return;

  const gap = Number.parseFloat(style.columnGap) || 0;
  const maxWidth = (row.clientWidth - gap) / 2;
  let width = 0;

  for (let step = 0; step < MAX_FIT_STEPS; step += 1) {
    row.style.setProperty('--image-width', `${width}px`);
    const next = Math.min(lead.getBoundingClientRect().height * imageRatio, maxWidth);
    if (Math.abs(next - width) < FIT_TOLERANCE_PX) break;
    width = next;
  }

  row.style.setProperty('--image-width', `${width}px`);
}

/** Büyük metin ve yanındaki görsel: görsel metnin yüksekliğindedir, kalan genişliği metin kullanır. */
export function LeadRow({ imageRatio, children }: { imageRatio: number; children: ReactNode }) {
  const { i18n } = useTranslation();
  const rowRef = useRef<HTMLDivElement>(null);

  // Yazı boyutu ve satır sayısı ekrana, dile ve fonta bağlı olduğu için ölçüm bunlarla yenilenir.
  useLayoutEffect(() => {
    const row = rowRef.current;
    if (!row) return;

    const fit = () => fitLeadRow(row, imageRatio);
    fit();

    // Ölçüm satırın yüksekliğini değiştirir, yalnızca genişlik değişince yeniden ölçülür.
    let lastWidth = row.clientWidth;
    const observer = new ResizeObserver(() => {
      if (row.clientWidth === lastWidth) return;
      lastWidth = row.clientWidth;
      fit();
    });
    observer.observe(row);
    document.fonts.addEventListener('loadingdone', fit);

    return () => {
      observer.disconnect();
      document.fonts.removeEventListener('loadingdone', fit);
    };
  }, [imageRatio, i18n.language]);

  return (
    <div ref={rowRef} className={styles.leadRow}>
      {children}
    </div>
  );
}

const IMAGE_SIZE_CLASSES: Readonly<Record<KnowledgeImageSize, string>> = {
  mark: styles.imageMark,
  wide: styles.imageWide,
  poster: styles.imagePoster,
  document: styles.imageDocument,
};

export function KnowledgeImage({ number, className = '' }: { number: KnowledgeImageNumber; className?: string }) {
  const { t } = useTranslation('knowledge');
  const { images } = useKnowledge();
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const { src, width, height, size } = KNOWLEDGE_IMAGES[number];
  const alt = images[number];

  return (
    <figure className={`${styles.figure} ${IMAGE_SIZE_CLASSES[size]} ${className}`}>
      <button
        className={styles.zoom}
        type="button"
        aria-label={t('common.openImage', { title: alt })}
        onClick={() => setIsLightboxOpen(true)}
      >
        <img className={styles.image} src={src} width={width} height={height} alt="" loading="lazy" decoding="async" />
      </button>
      {isLightboxOpen && (
        <Lightbox src={src} alt={alt} isDocument={size === 'document'} onClose={() => setIsLightboxOpen(false)} />
      )}
    </figure>
  );
}
