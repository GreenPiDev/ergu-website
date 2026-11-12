import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getKnowledgeChapter, getKnowledgeEntry } from '../../content/knowledge';
import { GenericCheckbox } from '../ui/GenericCheckbox/GenericCheckbox';
import { Chapter } from './Chapter';
import { ChecklistCompleteDialog } from './ChecklistCompleteDialog';
import styles from './ChecklistChapter.module.css';
import { Entry } from './Entry';
import { useKnowledge } from './knowledgeHooks';

function formatStep(index: number) {
  return String(index + 1).padStart(2, '0');
}

type ChecklistProps = {
  steps: { title: string; text: string }[];
  checked: ReadonlySet<number>;
  onToggle: (index: number) => void;
  onReset: () => void;
};

/** Elde tutulan kontrol formu gibi işaretlenir. Bir sonuç üretmez, yalnızca hatırlatır. */
function Checklist({ steps, checked, onToggle, onReset }: ChecklistProps) {
  const { t } = useTranslation('knowledge');

  return (
    <div>
      <ol className={styles.list}>
        {steps.map((step, index) => (
          <li key={step.title}>
            <GenericCheckbox
              checked={checked.has(index)}
              onChange={() => onToggle(index)}
              marker={formatStep(index)}
              label={step.title}
              description={step.text}
            />
          </li>
        ))}
      </ol>

      <div className={styles.footer}>
        <p aria-live="polite">{t('checklist.progress', { done: checked.size, total: steps.length })}</p>
        {checked.size > 0 && (
          <button className={styles.reset} type="button" onClick={onReset}>
            {t('checklist.reset')}
          </button>
        )}
      </div>
    </div>
  );
}

/** Vurgu renkli bölüm: sayfanın "karar anı". İşaretlenebilir liste, tamamlanınca iletişime yönlendiren pencere. */
export function ChecklistChapter() {
  const { entries } = useKnowledge();
  const [checked, setChecked] = useState<ReadonlySet<number>>(new Set());
  const [isCompleteOpen, setIsCompleteOpen] = useState(false);
  const chapter = getKnowledgeChapter('checklist');
  const steps = entries.criteria.steps ?? [];

  // Pencere yalnızca son kutu işaretlendiği anda açılır. Kaldırılıp yeniden tamamlanırsa tekrar açılır.
  const toggle = (index: number) => {
    const next = new Set(checked);
    if (!next.delete(index)) next.add(index);
    setChecked(next);
    if (steps.length > 0 && next.size === steps.length) setIsCompleteOpen(true);
  };

  return (
    <Chapter
      chapter={chapter}
      surface="light"
      tone="accent"
      className={styles.root}
      aside={
        <p className={styles.counter} aria-hidden="true">
          {checked.size}
          <span className={styles.counterTotal}>/{steps.length}</span>
        </p>
      }
    >
      <Entry entry={getKnowledgeEntry('criteria')}>
        <Checklist steps={steps} checked={checked} onToggle={toggle} onReset={() => setChecked(new Set())} />
        {isCompleteOpen && (
          <ChecklistCompleteDialog total={steps.length} onClose={() => setIsCompleteOpen(false)} />
        )}
      </Entry>
      <Entry entry={getKnowledgeEntry('process')} />
      <Entry entry={getKnowledgeEntry('closing')} className={styles.closing} />
    </Chapter>
  );
}
