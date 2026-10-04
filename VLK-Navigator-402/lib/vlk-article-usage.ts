import { ARTICLES, type SpecialtyId } from './vlk-sample-data.ts';

export const ARTICLE_USAGE_KEY = 'vlk-402-article-usage-v1';
export const PINNED_ARTICLES_KEY = 'vlk-402-pinned-articles-v1';
export type ArticleUsage = Record<string, { opens: number; lastOpenedAt: number }>;
const VALID = new Set(ARTICLES.map(article => article.article));
function record(raw: unknown): Record<string, unknown> | undefined {
  try { if (typeof raw === 'string') raw = JSON.parse(raw); } catch { return; }
  return raw && typeof raw === 'object' && !Array.isArray(raw) ? raw as Record<string, unknown> : undefined;
}
export function readArticleUsage(raw: unknown): ArticleUsage {
  const value = record(raw);
  const items = value?.version === 1 ? record(value.items) : undefined;
  const result: ArticleUsage = {};
  if (!items) return result;
  for (const [id, entry] of Object.entries(items)) {
    const item = record(entry);
    if (VALID.has(id) && item && typeof item.opens === 'number' && Number.isSafeInteger(item.opens) && item.opens > 0 &&
      typeof item.lastOpenedAt === 'number' && Number.isFinite(item.lastOpenedAt) && item.lastOpenedAt >= 0) {
      result[id] = { opens: Math.min(item.opens, 1_000_000), lastOpenedAt: item.lastOpenedAt };
    }
  }
  return result;
}
export function readPinnedArticles(raw: unknown): string[] {
  const value = record(raw);
  return value?.version === 1 && Array.isArray(value.articles)
    ? [...new Set(value.articles.filter((id): id is string => typeof id === 'string' && VALID.has(id)))] : [];
}
export function recordArticleOpen(usage: ArticleUsage, target: string, current: string | undefined, now = Date.now()): ArticleUsage {
  if (!VALID.has(target) || target === current) return usage;
  return { ...usage, [target]: { opens: Math.min((usage[target]?.opens ?? 0) + 1, 1_000_000), lastOpenedAt: now } };
}
export function togglePinned(pinned: readonly string[], article: string): string[] {
  if (!VALID.has(article)) return [...pinned];
  return pinned.includes(article) ? pinned.filter(id => id !== article) : [...pinned, article];
}
export function frequentArticles(usage: ArticleUsage, pinned: readonly string[], limit = 10): string[] {
  const ordered = Object.keys(usage).filter(id => VALID.has(id)).sort((a, b) =>
    usage[b].opens - usage[a].opens || usage[b].lastOpenedAt - usage[a].lastOpenedAt || Number(a) - Number(b));
  return [...new Set([...pinned.filter(id => VALID.has(id)), ...ordered])].slice(0, limit);
}
// Editorial starting lists, not measured frequency or a clinical priority.
export const SPECIALTY_QUICK_ACCESS: Record<SpecialtyId, readonly string[]> = {
  therapist: ['39', '38', '40', '47', '46', '13', '53', '54', '66', '42'],
  surgeon: ['61', '62', '64', '60', '78', '77', '55', '67', '8', '10'],
  neurologist: ['20', '21', '22', '23', '24', '41', '75', '76', '74'],
  psychiatrist: ['14', '15', '16', '17', '18', '19', '24', '75'],
  ophthalmologist: ['25', '26', '27', '28', '29', '30', '31', '32', '8', '10'],
  ent: ['33', '34', '35', '36', '37', '45', '8', '10', '11', '74'],
  dentist: ['49', '50', '51', '56', '74', '8', '10', '11', '81'],
  dermatologist: ['57', '58', '59', '3', '6', '1', '5', '8', '10', '74'],
};
export function specialtyQuickArticles(specialty: SpecialtyId): string[] {
  return SPECIALTY_QUICK_ACCESS[specialty].filter(id => ARTICLES.some(a => a.article === id && a.specialties.includes(specialty)));
}
