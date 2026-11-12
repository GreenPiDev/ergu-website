import '../i18n/knowledge';
import { useEffect, useRef } from 'react';
import { ScrollTrigger } from '../animations/gsap';
import { Chapter } from '../components/knowledge/Chapter';
import { ChecklistChapter } from '../components/knowledge/ChecklistChapter';
import { KnowledgeHero } from '../components/knowledge/KnowledgeHero';
import { useEntryJump, useKnowledge } from '../components/knowledge/knowledgeHooks';
import { SectionRail } from '../components/ui/SectionRail/SectionRail';
import { getKnowledgeChapter, KNOWLEDGE_CHAPTERS } from '../content/knowledge';
import styles from './KnowledgePage.module.css';

/**
 * Baştan sona okunan bir yazı değil, aranıp açılan bir başvuru kitabı.
 * Hero aynı zamanda dizin ve aramadır. Bölümlerde solda yapışık başlık ve madde dizini, sağda akan maddeler vardır.
 * Bölümlerin sırası `KNOWLEDGE_CHAPTERS` ile aynı olmalıdır, ray bu sırayı kullanır.
 */
export function KnowledgePage() {
  const { chapters, common } = useKnowledge();
  const jump = useEntryJump();
  const sequenceRef = useRef<HTMLDivElement>(null);

  // Paylaşılan madde adresiyle açılışta konum, fontlar yerine oturduktan sonra hesaplanır.
  useEffect(() => {
    let isCancelled = false;

    document.fonts.ready.then(
      () => {
        if (isCancelled) return;
        ScrollTrigger.refresh();
        const slug = window.location.hash.slice(1);
        if (slug) jump(slug, { immediate: true });
      },
      () => undefined,
    );

    return () => {
      isCancelled = true;
    };
  }, [jump]);

  return (
    <>
      <KnowledgeHero />

      <div ref={sequenceRef}>
        <Chapter chapter={getKnowledgeChapter('basics')} surface="light" />
        <Chapter chapter={getKnowledgeChapter('guide')} surface="dark" />
        <ChecklistChapter />
        <Chapter chapter={getKnowledgeChapter('faq')} surface="light" />
      </div>

      <SectionRail
        sequenceRef={sequenceRef}
        items={KNOWLEDGE_CHAPTERS.map(({ key }) => ({ key, label: chapters[key].short }))}
      />

      <section className={styles.note} data-surface="dark">
        <p className={styles.noteText}>{common.note}</p>
      </section>
    </>
  );
}
