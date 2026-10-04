import { ARTICLES } from './vlk-sample-data.ts';
import { OFFICIAL_ARTICLE_TEXTS } from './vlk-official-articles.ts';
import { EXPLANATION_META } from './explanations/index.ts';
import { explanationUrl, officialArticleUrl } from './vlk-links.ts';
import { EXPLANATION_REFERENCE_INDEX, CONTEXT_REFERENCE_INDEX } from './vlk-article-reference-data.ts';
import { parseArticleReferences } from './vlk-article-reference-parser.ts';

/** Navigation groups over the unchanged corpus: not new normative headings. */
export const ARTICLE_GROUPS = [
  { id: 'infectious', label: 'Інфекційні та паразитарні хвороби', from: 1, to: 7 },
  { id: 'neoplasms', label: 'Новоутворення та їх наслідки', from: 8, to: 11 },
  { id: 'blood', label: 'Хвороби крові та імунного механізму', from: 12, to: 12 },
  { id: 'endocrine', label: 'Ендокринні хвороби та обмін речовин', from: 13, to: 13 },
  { id: 'mental', label: 'Розлади психіки та поведінки', from: 14, to: 19 },
  { id: 'nervous', label: 'Хвороби нервової системи', from: 20, to: 24 },
  { id: 'eye', label: 'Хвороби ока та зору', from: 25, to: 32 },
  { id: 'ear', label: 'Хвороби вуха, слуху та рівноваги', from: 33, to: 37 },
  { id: 'circulation', label: 'Хвороби системи кровообігу', from: 38, to: 44 },
  { id: 'respiratory', label: 'Хвороби органів дихання', from: 45, to: 48 },
  { id: 'digestive', label: 'Хвороби органів травлення', from: 49, to: 56 },
  { id: 'skin', label: 'Хвороби шкіри та підшкірної клітковини', from: 57, to: 59 },
  { id: 'musculoskeletal', label: 'Хвороби кістково-м’язової системи', from: 60, to: 65 },
  { id: 'genitourinary', label: 'Хвороби сечостатевої системи', from: 66, to: 72 },
  { id: 'pregnancy', label: 'Вагітність, пологи та післяпологовий період', from: 73, to: 73 },
  { id: 'congenital', label: 'Вроджені вади розвитку', from: 74, to: 74 },
  { id: 'injury', label: 'Травми, отруєння та їх наслідки', from: 75, to: 81 },
  { id: 'other', label: 'Інші хворобливі прояви', from: 82, to: 87 },
] as const;

export type ArticleGroupId = (typeof ARTICLE_GROUPS)[number]['id'];
export type RelatedEvidence = {
  source: 'explanation' | 'schedule';
  paragraphIndex?: number;
  field?: 'included';
  relation: 'reference' | 'exclusion';
  targetPoints?: readonly string[];
  contextParagraphIndices?: readonly number[];
  sourceUrl: string;
};
export type RelatedArticle = {
  article: (typeof ARTICLES)[number];
  reason: string;
  kind: 'group' | 'reference';
  evidence: readonly RelatedEvidence[];
};
export type ContextReference = {
  id: string;
  paragraphIndex: number;
  quote: string;
  reason: string;
  groupIds: readonly ArticleGroupId[];
  sourceUrl: string;
};

const ARTICLE_BY_NUMBER = new Map(ARTICLES.map(article => [article.article, article]));

/** Both literal Schedule exclusions and explanatory referrals are direct links.
 * Full evidence is retained when several passages name the same target.
 * No inferred reverse links or automatic point/result selections. */
function directReferences(number: string): RelatedArticle[] {
  const evidenceByTarget = new Map<string, RelatedEvidence[]>();
  const append = (target: string, evidence: RelatedEvidence) => {
    if (target === number || !ARTICLE_BY_NUMBER.has(target)) return;
    const existing = evidenceByTarget.get(target) ?? [];
    existing.push(evidence);
    evidenceByTarget.set(target, existing);
  };
  const included = OFFICIAL_ARTICLE_TEXTS[number]?.included ?? '';
  const excludedOffset = included.indexOf('Виключено:');
  for (const reference of parseArticleReferences(included, number)) {
    append(reference.article, {
      source: 'schedule', field: 'included',
      relation: excludedOffset >= 0 && reference.offset >= excludedOffset ? 'exclusion' : 'reference',
      sourceUrl: officialArticleUrl(number),
    });
  }
  for (const reference of EXPLANATION_REFERENCE_INDEX[number] ?? []) {
    append(reference.target, {
      source: 'explanation', paragraphIndex: reference.paragraphIndex,
      relation: 'reference', targetPoints: reference.targetPoints,
      contextParagraphIndices: reference.contextParagraphIndices,
      sourceUrl: explanationUrl(EXPLANATION_META[number]?.anchor, officialArticleUrl(number)),
    });
  }
  return [...evidenceByTarget].flatMap(([target, evidence]) => {
    const article = ARTICLE_BY_NUMBER.get(target);
    if (!article) return [];
    const excluded = evidence.some(item => item.relation === 'exclusion');
    const referred = evidence.some(item => item.relation === 'reference');
    const reason = excluded
      ? `Виключено з цієї статті — включено до ст. ${target}${referred ? '; також є посилання в поясненні' : ''}`
      : 'Пряме посилання в офіційному поясненні';
    return [{ article, reason, kind: 'reference' as const, evidence }];
  });
}

/** Backwards-compatible map now covering every literal source. */
export const ARTICLE_CROSS_REFERENCES: Readonly<Record<string, readonly string[]>> = Object.fromEntries(
  ARTICLES.map(article => [article.article, directReferences(article.article).map(item => item.article.article)] as const)
    .filter(([, targets]) => targets.length > 0),
);

export function groupArticles(groupId: string, excludeArticle?: string) {
  const group = ARTICLE_GROUPS.find(item => item.id === groupId);
  return group ? ARTICLES.filter(article => article.article !== excludeArticle && Number(article.article) >= group.from && Number(article.article) <= group.to) : [];
}

/** limit controls compact fallback, never hides explicit normative links. */
export function relatedArticles(number: string, limit = 6): RelatedArticle[] {
  if (!ARTICLE_BY_NUMBER.has(number)) return [];
  const direct = directReferences(number);
  const directNumbers = new Set(direct.map(item => item.article.article));
  const group = ARTICLE_GROUPS.find(item => Number(number) >= item.from && Number(number) <= item.to);
  const groupLimit = Math.max(0, (Number.isFinite(limit) ? Math.floor(limit) : 6) - direct.length);
  const fallback: RelatedArticle[] = group ? groupArticles(group.id, number)
    .filter(article => !directNumbers.has(article.article))
    .sort((a, b) => Math.abs(Number(a.article) - Number(number)) - Math.abs(Number(b.article) - Number(number)) || Number(a.article) - Number(b.article))
    .slice(0, groupLimit)
    .map(article => ({ article, reason: group.label, kind: 'group', evidence: [] })) : [];
  return [...direct, ...fallback];
}

/** Read exact evidence from the selected article, not an eager full corpus. */
export function evidenceQuote(number: string, evidence: RelatedEvidence, paragraphs: readonly string[] = []): string {
  if (evidence.source === 'schedule') return OFFICIAL_ARTICLE_TEXTS[number]?.included ?? '';
  return evidence.paragraphIndex === undefined ? '' : paragraphs[evidence.paragraphIndex] ?? '';
}

export function contextReferences(number: string, paragraphs: readonly string[] = []): ContextReference[] {
  if (!ARTICLE_BY_NUMBER.has(number)) return [];
  return (CONTEXT_REFERENCE_INDEX[number] ?? []).map(reference => ({
    id: `${number}-context-${reference.paragraphIndex}`,
    paragraphIndex: reference.paragraphIndex,
    quote: paragraphs[reference.paragraphIndex] ?? '',
    reason: reference.reason,
    groupIds: ARTICLE_GROUPS.filter(group => reference.groupIds === 'all' || reference.groupIds.includes(group.id)).map(group => group.id),
    sourceUrl: explanationUrl(EXPLANATION_META[number]?.anchor, officialArticleUrl(number)),
  }));
}
