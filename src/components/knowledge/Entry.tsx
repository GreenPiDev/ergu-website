import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  getKnowledgeEntry,
  KNOWLEDGE_IMAGES,
  type KnowledgeEntry,
  type ListKind,
} from '../../content/knowledge';
import styles from './Chapter.module.css';
import { EntryLink, KnowledgeImage, LeadRow, RichText } from './KnowledgeText';
import { useKnowledge } from './knowledgeHooks';

const LIST_CLASSES: Readonly<Record<ListKind, string>> = {
  numbered: styles.listNumbered,
  flow: styles.listFlow,
  plain: styles.listPlain,
};

function formatStep(index: number) {
  return String(index + 1).padStart(2, '0');
}

function Paragraphs({ items }: { items?: string[] }) {
  return items?.map((text) => (
    <p key={text} className={styles.paragraph}>
      <RichText text={text} />
    </p>
  ));
}

type EntryProps = {
  entry: KnowledgeEntry;
  className?: string;
  /** Adımların yerine geçen etkileşimli içerik. */
  children?: ReactNode;
};

/** Sözlük maddesi: numara, başlık, öne çıkan tanım ve ardından ayrıntılar. */
export function Entry({ entry, className = '', children }: EntryProps) {
  const { i18n } = useTranslation();
  const { entries, common } = useKnowledge();
  const text = entries[entry.key];
  // Geniş görsel metnin altında kalır, diğerleri büyük metinle aynı satırı paylaşır.
  const imageInfo = entry.image ? KNOWLEDGE_IMAGES[entry.image] : undefined;

  const lead = text.lead && (
    <p className={styles.lead}>
      {text.verdict && (
        <>
          {/* Boşluk vurgunun dışındadır, iki yana yaslı metinde genişleyip sarıya boyanmasın. */}
          <strong className={styles.verdict}>{text.verdict.toLocaleUpperCase(i18n.language)}</strong>{' '}
        </>
      )}
      <RichText text={text.lead} />
    </p>
  );
  const image = entry.image && <KnowledgeImage number={entry.image} />;

  return (
    <article
      id={entry.slug}
      className={`${styles.entry} ${entry.imageInAside ? styles.entryAsideImage : ''} ${className}`}
      tabIndex={-1}
      data-entry
    >
      <span className={styles.mark} aria-hidden="true" data-entry-mark />

      <p className={styles.code} aria-hidden="true">
        {entry.code}
      </p>
      <h3 className={styles.entryTitle}>{text.title}</h3>

      {imageInfo && imageInfo.size !== 'wide' ? (
        <LeadRow imageRatio={imageInfo.width / imageInfo.height}>
          {lead}
          {image}
        </LeadRow>
      ) : (
        <>
          {lead}
          {image}
        </>
      )}
      <Paragraphs items={text.body} />

      {text.listIntro && <p className={styles.paragraph}>{text.listIntro}</p>}
      {text.list && (
        <ul className={LIST_CLASSES[entry.listKind ?? 'plain']}>
          {text.list.map((item, index) => (
            <li key={item} className={styles.listItem}>
              {entry.listKind === 'numbered' && (
                <span className={styles.listNumber} aria-hidden="true">
                  {index + 1}
                </span>
              )}
              <span>
                <RichText text={item} />
              </span>
            </li>
          ))}
        </ul>
      )}

      {children ??
        (text.steps && (
          <ol className={styles.steps}>
            {text.steps.map((step, index) => (
              <li key={step.title} className={styles.step}>
                <span className={styles.stepNumber} aria-hidden="true">
                  {formatStep(index)}
                </span>
                <h4 className={styles.stepTitle}>{step.title}</h4>
                <p className={styles.stepText}>{step.text}</p>
              </li>
            ))}
          </ol>
        ))}

      {text.rows && text.columns && (
        <table className={styles.table}>
          <thead>
            <tr>
              {text.columns.map((column) => (
                <th key={column} scope="col">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {text.rows.map((row, index) => (
              <tr key={row.type}>
                <th scope="row">
                  {/* Satırın ilgili maddesi varsa ad bağlantı olur, yoksa düz yazıdır. */}
                  {entry.tableLinks?.[index] ? (
                    <EntryLink className={styles.tableLink} slug={getKnowledgeEntry(entry.tableLinks[index]).slug}>
                      {row.type}
                    </EntryLink>
                  ) : (
                    <span className={styles.tableLink}>{row.type}</span>
                  )}
                </th>
                <td>{row.use}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {text.callout && (
        <p className={styles.callout}>
          <span className={styles.calloutText}>{text.callout}</span>
        </p>
      )}

      <Paragraphs items={text.outro} />

      {text.more && (
        <p className={styles.more}>
          <RichText text={text.more} />
        </p>
      )}

      {entry.seeAlso && (
        <p className={styles.seeAlso}>
          <span className={styles.seeAlsoLabel}>{common.seeAlso}</span>
          {entry.seeAlso.map((key) => (
            <EntryLink key={key} className={styles.seeAlsoLink} slug={getKnowledgeEntry(key).slug}>
              {entries[key].title}
            </EntryLink>
          ))}
        </p>
      )}
    </article>
  );
}
