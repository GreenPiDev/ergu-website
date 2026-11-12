import { type ReactNode, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { KnowledgeChapter } from '../../content/knowledge';
import styles from './Chapter.module.css';
import { Entry } from './Entry';
import { EntryLink, KnowledgeImage } from './KnowledgeText';
import { useActiveEntry, useChapterReveal, useKnowledge } from './knowledgeHooks';

type ChapterProps = {
  chapter: KnowledgeChapter;
  surface: 'dark' | 'light';
  /** Vurgu renkli zemin. Bölüm rayı ve imleç halkası bu bölümde düz renge geçer. */
  tone?: 'accent';
  className?: string;
  /** Yapışık başlık sütununun altındaki ek içerik. */
  aside?: ReactNode;
  /** Verilmezse bölümün maddeleri sırayla yazılır. */
  children?: ReactNode;
  /** Maddelerin altındaki uyarı. */
  note?: string;
};

/** Sözlük düzeni: solda yapışık bölüm başlığı ve madde dizini, sağda akan maddeler. */
export function Chapter({ chapter, surface, tone, className = '', aside, children, note }: ChapterProps) {
  const { i18n } = useTranslation();
  const { chapters, entries, common } = useKnowledge();
  const rootRef = useRef<HTMLElement>(null);
  const entriesRef = useRef<HTMLDivElement>(null);
  const activeIndex = useActiveEntry(entriesRef);

  // Sol sütundaki görsel yalnızca kendi maddesi okunurken görünür.
  const asideImages = chapter.entries.flatMap((entry, index) =>
    entry.image && entry.imageInAside ? [{ number: entry.image, index }] : [],
  );
  const activeAsideImage = asideImages.find((item) => item.index === activeIndex);

  useChapterReveal(rootRef);

  return (
    <section
      ref={rootRef}
      id={chapter.slug}
      className={`${styles.chapter} ${className}`}
      data-surface={surface}
      data-tone={tone}
      data-rail-solid={tone === 'accent' ? true : undefined}
      tabIndex={-1}
    >
      {/* Görsel gizlendiğinde sütun yüksekliği değişmesin diye alan her zaman ayrılır. */}
      <header className={`${styles.head} ${asideImages.length > 0 ? styles.headWithImage : ''}`}>
        <p className={styles.number} aria-hidden="true">
          {chapter.number}
        </p>
        <h2 key={i18n.language} className={styles.chapterTitle} data-chapter-title>
          {chapters[chapter.key].title}
        </h2>

        <nav className={styles.toc} aria-label={common.entryIndex}>
          <ol className={styles.tocList}>
            {chapter.entries.map((entry, index) => (
              <li key={entry.key}>
                <EntryLink
                  className={`${styles.tocLink} ${index === activeIndex ? styles.tocActive : ''}`}
                  slug={entry.slug}
                >
                  <span className={styles.tocCode} aria-hidden="true">
                    {entry.code}
                  </span>
                  <span>{entries[entry.key].short ?? entries[entry.key].title}</span>
                </EntryLink>
              </li>
            ))}
          </ol>
        </nav>

        {asideImages.length > 0 && (
          <div className={styles.asideImages}>
            {asideImages.map(({ number }) => (
              <KnowledgeImage
                key={number}
                number={number}
                className={number === activeAsideImage?.number ? styles.asideImageActive : ''}
              />
            ))}
          </div>
        )}

        {aside}
      </header>

      <div ref={entriesRef} className={styles.entries}>
        {children ?? chapter.entries.map((entry) => <Entry key={entry.key} entry={entry} />)}
        {note && <p className={styles.chapterNote}>{note}</p>}
      </div>
    </section>
  );
}
