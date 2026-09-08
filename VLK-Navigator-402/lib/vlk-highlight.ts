import { highlightParts, parseArticleNumber } from "./vlk-search.ts";

/** Presentation only; does not affect ranking or normative matching. */
export function displayHighlightParts(text: string, query: string) {
  const article = parseArticleNumber(query);
  if (!article) return highlightParts(text, query);
  // Includes articles 1–9, ignored by the generic minimum-two-letter tokenizer.
  return text.split(/(\d+)/u).filter(Boolean).map((part) => ({
    text: part, match: part === article,
  }));
}
