import { KNOWLEDGE_CHAPTERS, KNOWLEDGE_ENTRIES, type KnowledgeEntry } from '../../content/knowledge';
import type { EntryText } from './knowledgeHooks';

// Sonuçlar hero'daki bölüm satırlarının yerini alır, sayıları eşit olunca arama yazarken hero'nun boyu değişmez.
export const MAX_RESULTS = KNOWLEDGE_CHAPTERS.length;

const TITLE_START_SCORE = 3;
const TITLE_SCORE = 2;
const BODY_SCORE = 1;

export type SearchRecord = {
  entry: KnowledgeEntry;
  title: string;
  normalizedTitle: string;
  haystack: string;
};

/** "rakör", "RAKOR" ve "rakor" aynı sonucu versin diye büyük harf ve aksanlar yok sayılır. */
export function normalizeSearchText(text: string, locale: string): string {
  return text
    .toLocaleLowerCase(locale)
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/ı/g, 'i');
}

function collectStrings(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(collectStrings);
  if (typeof value === 'object' && value !== null) return Object.values(value).flatMap(collectStrings);
  return [];
}

export function buildSearchIndex(entries: Record<string, EntryText>, locale: string): SearchRecord[] {
  return KNOWLEDGE_ENTRIES.map((entry) => {
    const text = entries[entry.key];
    return {
      entry,
      title: text.title,
      normalizedTitle: normalizeSearchText(text.title, locale),
      // Metindeki bağlantı etiketleri arama sonucunu etkilemesin.
      haystack: normalizeSearchText(collectStrings(text).join(' ').replace(/<[^>]+>/g, ''), locale),
    };
  });
}

export function searchEntries(index: SearchRecord[], query: string, locale: string): SearchRecord[] {
  const normalized = normalizeSearchText(query.trim(), locale);
  const tokens = normalized.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return [];

  return index
    .filter(({ haystack }) => tokens.every((token) => haystack.includes(token)))
    .map((record) => {
      const titleHasAll = tokens.every((token) => record.normalizedTitle.includes(token));
      const titleScore = record.normalizedTitle.startsWith(normalized) ? TITLE_START_SCORE : TITLE_SCORE;
      return { record, score: titleHasAll ? titleScore : BODY_SCORE };
    })
    .sort((first, second) => second.score - first.score)
    .slice(0, MAX_RESULTS)
    .map(({ record }) => record);
}
