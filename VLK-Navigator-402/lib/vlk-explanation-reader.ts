import { pointMentions } from "./vlk-explanation-view.ts";

/** Navigate only to a real source heading, never to an inferred clinical section. */
export function explanationPointStart(paragraphs: readonly string[], point?: string) {
  if (!point || !paragraphs.length) return undefined;
  if (point === "—") return 0;
  const index = paragraphs.findIndex((paragraph) =>
    /^(?:\d+\)\s*)?(?:(?:до|за)\s+пункт|пункт)/iu.test(paragraph) && pointMentions(paragraph).includes(point));
  return index < 0 ? undefined : index;
}

/** Return source indices, including table cells. The complete document stays intact. */
export function explanationFindMatches(paragraphs: readonly string[], query: string) {
  if (!query.trim()) return [];
  return paragraphs.flatMap((paragraph, index) =>
    explanationFindParts(paragraph, query).some((part) => part.match) ? [index] : []);
}

/** Literal, case-insensitive in-document find, including numbers and single letters. */
export function explanationFindParts(text: string, query: string) {
  const needle = query.trim();
  if (!needle) return [{ text, match: false }];
  const pattern = new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "giu");
  const parts: Array<{ text: string; match: boolean }> = [];
  let end = 0;
  for (const found of text.matchAll(pattern)) {
    const start = found.index;
    if (start > end) parts.push({ text: text.slice(end, start), match: false });
    parts.push({ text: found[0], match: true });
    end = start + found[0].length;
  }
  if (end < text.length) parts.push({ text: text.slice(end), match: false });
  return parts.length ? parts : [{ text, match: false }];
}
