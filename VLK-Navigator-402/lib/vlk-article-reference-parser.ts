/** Parse explicitly numbered Schedule articles, never ICD codes or section
 * numbers. Unnumbered referrals are kept in separate reviewed metadata. */
export type ParsedArticleReference = { article: string; mention: string; offset: number };

export function parseArticleReferences(text: string, sourceArticle?: string): ParsedArticleReference[] {
  const references: ParsedArticleReference[] = [];
  const pattern = /(?:^|[^\p{L}\p{N}_])(?:статт(?:я|і|ею|ю|ями|ях)|статей|ст\.)\s+(\d+(?:\s*[-–—]\s*\d+)?(?:\s*(?:,|або|та|і|чи)\s*\d+(?:\s*[-–—]\s*\d+)?)*)/giu;
  for (const match of text.matchAll(pattern)) {
    // A regulation section such as 20.3 is not Schedule article20.
    if (/^\.\d/u.test(text.slice((match.index ?? 0) + match[0].length))) continue;
    for (const item of match[1].split(/\s*(?:,|або|та|і|чи)\s*/u)) {
      const bounds = item.split(/\s*[-–—]\s*/u).map(Number);
      const from = bounds[0];
      const to = bounds[1] ?? from;
      if (from < 1 || to > 87 || to < from) continue;
      for (let number = from; number <= to; number += 1) {
        const article = String(number);
        if (article !== sourceArticle) references.push({ article, mention: match[0].trim(), offset: match.index ?? 0 });
      }
    }
  }
  return references;
}
