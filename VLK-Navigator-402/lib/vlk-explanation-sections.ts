import { explanationBlocks, type ExplanationBlock } from './vlk-explanation-tables.ts';
export type ExplanationSection = { id: string; label: string; blocks: ExplanationBlock[]; indices: number[] };
function indicesFor(block: ExplanationBlock) {
  return block.kind === 'paragraph' ? [block.index] : Array.from({ length: block.table.end - block.table.start + 1 }, (_, i) => block.table.start + i);
}
/** Only partitions existing blocks. A table is always indivisible. */
export function explanationSections(article: string, paragraphs: readonly string[], excerpt?: readonly string[]): ExplanationSection[] {
  const sections: ExplanationSection[] = [];
  for (const block of explanationBlocks(article, paragraphs, excerpt)) {
    const indices = indicesFor(block);
    const first = paragraphs[indices[0]] ?? '';
    const startsHeading = /^(?:\d+\)\s*)?(?:до|за)\s+пункт|^пункт/iu.test(first);
    const previous = sections.at(-1);
    if (block.kind === 'table' || !previous || previous.blocks[0].kind === 'table' || previous.blocks.length >= 6 || startsHeading) {
      sections.push({ id: `${article}-${indices[0]}`, label: block.kind === 'table' ? `Таблиця ${block.table.number}` : '', blocks: [block], indices });
    } else { previous.blocks.push(block); previous.indices.push(...indices); }
  }
  return sections.map(section => ({ ...section, label: section.label || (section.indices.length === 1
    ? `Фрагмент ${section.indices[0] + 1}` : `Фрагменти ${section.indices[0] + 1}–${section.indices.at(-1)! + 1}`) }));
}
/** Plain paragraphs and tab-separated table rows. Every source fragment stays intact. */
export function explanationPlainText(article: string, paragraphs: readonly string[]): string {
  return explanationBlocks(article, paragraphs).map(block => {
    if (block.kind === 'paragraph') return paragraphs[block.index];
    const table = block.table;
    const rows = [...table.head, ...table.body].map(row => row.map(cell => cell.indices.map(index => paragraphs[index]).join('\n')).join('\t'));
    return [paragraphs[table.start], paragraphs[table.start + 1], ...rows].join('\n');
  }).join('\n\n');
}
