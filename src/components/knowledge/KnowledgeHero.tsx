import { type CSSProperties, type FormEvent, type KeyboardEvent, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { gsap, MOTION, useGSAP } from '../../animations/gsap';
import { getPageIntroDelay } from '../../animations/pageIntro';
import { KNOWLEDGE_CHAPTERS } from '../../content/knowledge';
import { usePrefersReducedMotion } from '../../hooks/useDevice';
import { getLocaleFromPathname, localizePath } from '../../i18n/locale';
import { PageHero } from '../layout/PageHero/PageHero';
import { ScrollCue } from '../ui/ScrollCue/ScrollCue';
import { EntryLink } from './KnowledgeText';
import styles from './KnowledgeHero.module.css';
import { useEntryJump, useKnowledge } from './knowledgeHooks';
import { buildSearchIndex, searchEntries } from './search';

const KNOWLEDGE_SEARCH_INPUT_ID = 'knowledge-search';

/** Sayfanın girişi aynı zamanda dizindir: yazmaya başlayınca bölüm satırlarının yerini sonuçlar alır. */
export function KnowledgeHero() {
  const { t, i18n } = useTranslation('knowledge');
  const { entries, chapters, hero } = useKnowledge();
  const prefersReducedMotion = usePrefersReducedMotion();
  const jump = useEntryJump();
  const rootRef = useRef<HTMLElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');

  const locale = i18n.language;
  const index = useMemo(() => buildSearchIndex(entries, locale), [entries, locale]);
  const results = useMemo(() => searchEntries(index, query, locale), [index, query, locale]);
  const isSearching = query.trim().length > 0;

  useGSAP(
    () => {
      if (prefersReducedMotion) return;

      const delay = getPageIntroDelay();
      const motion = { duration: MOTION.slow, ease: MOTION.ease };
      gsap.from('[data-hero-search]', { autoAlpha: 0, y: 32, ...motion, delay });
      gsap.from('[data-hero-row]', { yPercent: 110, ...motion, stagger: MOTION.stagger, delay: delay + 0.1 });
    },
    { scope: rootRef, dependencies: [prefersReducedMotion], revertOnUpdate: true },
  );

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (results[0]) jump(results[0].entry.slug);
  };

  const clear = () => {
    setQuery('');
    inputRef.current?.focus();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') clear();
  };

  const contactPath = localizePath('/contact', getLocaleFromPathname(window.location.pathname));

  return (
    <PageHero
      ref={rootRef}
      className={styles.hero}
      title={i18n.t('nav.items.knowledgeCenter', { ns: 'common' }).toLocaleUpperCase(locale)}
    >
      <div className={styles.panel}>
        <form className={styles.search} role="search" onSubmit={handleSubmit} data-hero-search>
          <label className={styles.srOnly} htmlFor={KNOWLEDGE_SEARCH_INPUT_ID}>
            {hero.searchLabel}
          </label>
          <input
            ref={inputRef}
            id={KNOWLEDGE_SEARCH_INPUT_ID}
            className={styles.input}
            type="search"
            value={query}
            placeholder={hero.placeholder}
            autoComplete="off"
            enterKeyHint="search"
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={handleKeyDown}
          />
          {isSearching && (
            <button className={styles.clear} type="button" aria-label={hero.clear} onClick={clear}>
              <span className={styles.clearMark} aria-hidden="true" />
            </button>
          )}
        </form>

        <p className={styles.hint}>{hero.hint}</p>
        <p className={styles.srOnly} aria-live="polite">
          {isSearching ? t('hero.resultCount', { count: results.length }) : ''}
        </p>

        {isSearching && results.length === 0 ? (
          <p className={styles.empty}>
            {hero.noResults}{' '}
            <Link className={styles.emptyLink} to={contactPath}>
              {hero.noResultsLink}
            </Link>
          </p>
        ) : (
          <ol
            className={styles.list}
            style={{ '--list-rows': KNOWLEDGE_CHAPTERS.length } as CSSProperties}
            aria-label={isSearching ? hero.resultsLabel : hero.indexLabel}
          >
            {isSearching
              ? results.map(({ entry, title }) => (
                  <li key={entry.key} className={styles.item}>
                    <EntryLink className={styles.row} slug={entry.slug}>
                      <span className={styles.number} aria-hidden="true">
                        {entry.code}
                      </span>
                      <span className={styles.result}>{title}</span>
                      <span className={styles.meta}>{chapters[entry.chapterKey].short}</span>
                    </EntryLink>
                  </li>
                ))
              : KNOWLEDGE_CHAPTERS.map((chapter) => (
                  <li key={chapter.key} className={styles.item}>
                    <EntryLink className={styles.row} slug={chapter.slug}>
                      <span className={styles.rowReveal} data-hero-row>
                        <span className={styles.rowInner}>
                          <span className={styles.number} aria-hidden="true">
                            {chapter.number}
                          </span>
                          <span className={styles.chapter}>{chapters[chapter.key].title}</span>
                        </span>
                      </span>
                    </EntryLink>
                  </li>
                ))}
          </ol>
        )}
      </div>

      <ScrollCue className={styles.cue} />
    </PageHero>
  );
}
