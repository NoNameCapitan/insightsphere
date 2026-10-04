import { TDV_RULES } from './vlk-tdv.ts';
export function getPointTdv(article: string, point: string) {
  const exact = point !== '—' ? `${article}-${point}` : article;
  const key = Object.hasOwn(TDV_RULES, exact) ? exact : article;
  if (!Object.hasOwn(TDV_RULES, key)) return null;
  const marks = TDV_RULES[key];
  if (!Object.values(marks).some(mark => mark.trim())) return null;
  return { sourceRowKey: key, scope: key === article ? 'article' as const : 'point' as const, marks };
}
