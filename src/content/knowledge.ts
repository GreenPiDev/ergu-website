/**
 * Bilgi merkezinin yapısı. Metinler `locales/{tr,en}/knowledge.json` içindedir, burada yalnızca dile bağlı olmayan yapı durur.
 * Bölüm ve madde eklemek için buraya tanımı, iki çeviri dosyasına da aynı anahtarla metni ekleyin.
 */

export type KnowledgeImageNumber = 1 | 2 | 3 | 4;
/** mark: küçük amblem, wide: metnin altında tam genişlik, poster ve document: metnin yanında dikey görsel. */
export type KnowledgeImageSize = 'mark' | 'wide' | 'poster' | 'document';

/** Genişlik ve yükseklik dosyanın gerçek ölçüleridir, görsel inerken sayfa kaymasın diye gereklidir. */
export const KNOWLEDGE_IMAGES: Readonly<
  Record<KnowledgeImageNumber, { src: string; width: number; height: number; size: KnowledgeImageSize }>
> = {
  1: { src: '/knowledge-1.svg', width: 286, height: 344, size: 'mark' },
  2: { src: '/knowledge-2.svg', width: 1752, height: 897, size: 'wide' },
  3: { src: '/knowledge-3.svg', width: 1024, height: 1536, size: 'poster' },
  4: { src: '/knowledge-4.svg', width: 1086, height: 1448, size: 'document' },
};

/** Anahtarlar çeviri metinlerindeki bağlantı etiketleridir, ör. `<docs>...</docs>`. Yeni sekmede açılırlar. */
export const EXTERNAL_LINKS = {
  docs: 'https://example.com',
} as const;

export type ChapterKey = 'basics' | 'guide' | 'checklist' | 'faq';
/** numbered: numaralı satırlar, flow: eğik çizgiyle ayrılmış tek blok, plain: numarasız satırlar. */
export type ListKind = 'numbered' | 'flow' | 'plain';

type EntryDefinition = {
  key: string;
  /** Sayfa içi bağlantı adresi. Her iki dilde de İngilizcedir. */
  slug: string;
  listKind?: ListKind;
  image?: KnowledgeImageNumber;
  /** Yan sütunlu ekranda görsel metnin yanında değil, sol sütunda madde dizininin altında durur. */
  imageInAside?: boolean;
  /** Tablo satırlarının açtığı maddelerin anahtarları, satır sırasıyla aynıdır. */
  tableLinks?: readonly string[];
  /** "Bkz." satırında gösterilecek maddelerin anahtarları. */
  seeAlso?: readonly string[];
};

type ChapterDefinition = {
  key: ChapterKey;
  slug: string;
  entries: readonly EntryDefinition[];
};

const CHAPTERS: readonly ChapterDefinition[] = [
  {
    key: 'basics',
    slug: 'basics',
    entries: [
      { key: 'intro', slug: 'introduction', image: 1, seeAlso: ['faqStart'] },
      { key: 'overview', slug: 'overview', image: 2, listKind: 'numbered', seeAlso: ['comparison'] },
      { key: 'scope', slug: 'scope', listKind: 'flow' },
      { key: 'principle', slug: 'principle' },
    ],
  },
  {
    key: 'guide',
    slug: 'guide',
    entries: [
      { key: 'guideIntro', slug: 'guide-introduction', image: 3, imageInAside: true },
      // Tablo iki görselli maddeyi ayırır, ilk görsel yan sütunda daha uzun kalır.
      { key: 'comparison', slug: 'comparison', tableLinks: ['optionA', 'optionB'] },
      { key: 'optionA', slug: 'option-a', image: 4, imageInAside: true, seeAlso: ['comparison'] },
      { key: 'optionB', slug: 'option-b', listKind: 'plain' },
    ],
  },
  {
    key: 'checklist',
    slug: 'checklist',
    entries: [
      { key: 'criteria', slug: 'criteria', seeAlso: ['faqHelp'] },
      { key: 'process', slug: 'process' },
      { key: 'closing', slug: 'closing' },
    ],
  },
  {
    key: 'faq',
    slug: 'faq',
    entries: [
      { key: 'faqStart', slug: 'faq-where-to-start', seeAlso: ['intro'] },
      { key: 'faqDifference', slug: 'faq-difference', seeAlso: ['optionA', 'optionB'] },
      { key: 'faqHelp', slug: 'faq-help', seeAlso: ['criteria'] },
    ],
  },
];

export type KnowledgeEntry = EntryDefinition & {
  chapterKey: ChapterKey;
  /** Sözlükteki madde numarası, ör. 2.3. */
  code: string;
};

export type KnowledgeChapter = Omit<ChapterDefinition, 'entries'> & {
  number: string;
  entries: readonly KnowledgeEntry[];
};

export const KNOWLEDGE_CHAPTERS: readonly KnowledgeChapter[] = CHAPTERS.map((chapter, chapterIndex) => ({
  ...chapter,
  number: String(chapterIndex + 1).padStart(2, '0'),
  entries: chapter.entries.map((entry, entryIndex) => ({
    ...entry,
    chapterKey: chapter.key,
    code: `${chapterIndex + 1}.${entryIndex + 1}`,
  })),
}));

export const KNOWLEDGE_ENTRIES: readonly KnowledgeEntry[] = KNOWLEDGE_CHAPTERS.flatMap(({ entries }) => entries);

export function getKnowledgeChapter(key: ChapterKey): KnowledgeChapter {
  const chapter = KNOWLEDGE_CHAPTERS.find((item) => item.key === key);
  if (!chapter) throw new Error(`Bilinmeyen bölüm: ${key}`);
  return chapter;
}

export function getKnowledgeEntry(key: string): KnowledgeEntry {
  const entry = KNOWLEDGE_ENTRIES.find((item) => item.key === key);
  if (!entry) throw new Error(`Bilinmeyen madde: ${key}`);
  return entry;
}
