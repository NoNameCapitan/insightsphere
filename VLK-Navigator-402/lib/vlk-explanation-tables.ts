/** Presentation-only grid over the unchanged, edition-pinned paragraph corpus.
 * Indices retain every source fragment, including grouped headings and column numbers.
 * This reconstructs readable tables, not a facsimile of the official document.
 */
export type ExplanationCell = {
  indices: number[];
  colSpan?: number;
  rowSpan?: number;
};
export type ExplanationGrid = {
  number: number;
  start: number;
  end: number;
  columns: number;
  head: ExplanationCell[][];
  body: ExplanationCell[][];
};

const cell = (index: number, colSpan = 1, rowSpan = 1): ExplanationCell => ({
  indices: index < 0 ? [] : [index], colSpan, rowSpan,
});
const row = (...indices: number[]) => indices.map((index) => cell(index));
function rows(start: number, end: number, width: number): ExplanationCell[][] {
  if ((end - start + 1) % width) throw new Error("Incomplete explanation table row");
  return Array.from({ length: (end - start + 1) / width }, (_, r) =>
    Array.from({ length: width }, (_, c) => cell(start + r * width + c)),
  );
}
const grid = (number: number, start: number, end: number, columns: number,
  head: ExplanationCell[][], body: ExplanationCell[][]): ExplanationGrid =>
  ({ number, start, end, columns, head, body });

/** A repeated row label occupies one merged cell; its literal text appears once. */
function group(start: number, count: number, width: number): ExplanationCell[][] {
  return [
    [cell(start, 1, count), ...row(...Array.from({ length: width - 1 }, (_, i) => start + i + 1))],
    ...rows(start + width, start + width + (count - 1) * (width - 1) - 1, width - 1),
  ];
}

const GRIDS: Readonly<Record<string, ExplanationGrid[]>> = {
  "13": [
    grid(1, 24, 41, 3, [
      [cell(26, 1, 2), cell(27, 2)], row(28, 29), row(30, 31, 32),
    ], rows(33, 41, 3)),
    grid(2, 47, 237, 7, rows(49, 62, 7), rows(63, 237, 7)),
  ],
  "35": [grid(3, 9, 22, 4, rows(11, 18, 4), rows(19, 22, 4))],
  "36": [grid(4, 3, 36, 4, rows(5, 8, 4), rows(9, 36, 4))],
  "38": [
    grid(5, 7, 41, 5, [row(-1, 9, 10, 11, 12), row(13, 14, 15, 16, 17)], [
      ...rows(18, 37, 5), row(38, -1, 39, 40, 41),
    ]),
    grid(6, 43, 65, 4, [row(-1, 45, 46, 47), row(48, 49, 50, 51)], [
      [cell(52, 4)], row(53, 54, 55, 56), [cell(57, 4)], ...rows(58, 65, 4),
    ]),
    grid(7, 107, 160, 4, rows(109, 116, 4), [
      [cell(117, 4)], ...rows(118, 133, 4), [cell(134, 4)], ...rows(135, 150, 4),
      [cell(151, 4)], ...rows(152, 159, 4), [cell(160, 4)],
    ]),
    grid(8, 168, 221, 4, rows(170, 177, 4), [
      [cell(178, 4)], ...rows(179, 198, 4), [cell(199, 4)], ...rows(200, 211, 4),
      [cell(212, 4)], ...rows(213, 220, 4), [cell(221, 4)],
    ]),
    grid(9, 226, 275, 4, rows(228, 235, 4), [
      [cell(236, 4)], ...rows(237, 248, 4), [cell(249, 4)], ...rows(250, 265, 4),
      [cell(266, 4)], ...rows(267, 274, 4), [cell(275, 4)],
    ]),
    grid(10, 294, 318, 4, rows(296, 303, 4), [
      ...rows(304, 315, 4), row(316, 317, 318, -1),
    ]),
  ],
  "39": [grid(11, 1, 31, 4, [
    [cell(3, 2), cell(4), cell(5)], [cell(6, 2), cell(7), cell(8)],
  ], [...group(9, 3, 4), ...group(19, 4, 4)])],
  "40": [grid(12, 52, 74, 5, [
    [cell(54, 1, 2), cell(55, 4)], row(56, 57, 58, 59),
  ], rows(60, 74, 5))],
  "46": [grid(13, 9, 48, 5, [
    [cell(11, 1, 2), cell(12, 1, 2), cell(13, 3)], row(14, 15, 16), row(17, 18, 19, 20, 21),
  ], [row(22, -1, 23, 24, 25), [cell(26, 5)],
    row(27, -1, -1, -1, 28), row(29, -1, -1, -1, 30), row(31, -1, -1, -1, 32),
    [cell(33, 5)], ...rows(34, 48, 5),
  ])],
  "61": [grid(14, 30, 141, 6, [
    [cell(32, 1, 2), cell(33, 1, 2), cell(34, 1, 2), cell(35, 3)],
    row(36, 37, 38), row(39, 40, 41, 42, 43, 44),
  ], [
    ...group(45, 3, 6), ...group(61, 4, 6),
    [cell(82, 1, 4), ...row(83, 84, 85, 86, 87)], row(88, 89, 90, 91, 92),
    [{ indices: [93, 94] }, ...row(95, 96, 97, 98)], row(99, 100, 101, 102, 103),
    ...group(104, 3, 6), ...group(120, 2, 6), ...group(131, 2, 6),
  ])],
  "62": [grid(15, 37, 56, 3, rows(39, 44, 3), rows(45, 56, 3))],
  "64": [grid(16, 40, 86, 6, [
    [cell(42, 1, 2), cell(43, 1, 2), cell(44, 1, 2), cell(45, 3)],
    row(46, 47, 48), row(49, 50, 51, 52, 53, 54),
  ], [...group(55, 3, 6), ...group(71, 3, 6)])],
  "66": [
    grid(17, 2, 7, 2, [], rows(4, 7, 2)),
    grid(18, 10, 32, 3, rows(12, 17, 3), rows(18, 32, 3)),
    grid(19, 33, 62, 4, rows(35, 42, 4), rows(43, 62, 4)),
  ],
};

// Accidental-content-change guard, not a cryptographic authenticity claim.
// Rebuild metadata and fixtures together after an independently verified edition change.
const TABLE_SIGNATURES: Readonly<Record<number, string>> = {
  1: "d3e467ea", 2: "f1dbb8f0", 3: "a5150dc0", 4: "e56f31c3", 5: "712201d4",
  6: "234b0540", 7: "df14fcc0", 8: "c5219802", 9: "7e6f0470", 10: "b5abf514",
  11: "8a26a25a", 12: "78a9abfe", 13: "7b8304ef", 14: "73b8ee78", 15: "7cebafe8",
  16: "9d5f9ab9", 17: "a48bd9e5", 18: "ce6cd36c", 19: "7e7f6124",
};

function tableSignature(paragraphs: readonly string[]) {
  let hash = 2166136261;
  for (const character of JSON.stringify(paragraphs)) {
    hash = Math.imul(hash ^ character.charCodeAt(0), 16777619) >>> 0;
  }
  return hash.toString(16);
}

export function explanationTables(article: string, paragraphs: readonly string[]) {
  // Never apply positional metadata to a changed or partial document.
  return (GRIDS[article] ?? []).filter((table) =>
    paragraphs[table.start] === `Таблиця ${table.number}` && paragraphs.length > table.end &&
    tableSignature(paragraphs.slice(table.start, table.end + 1)) === TABLE_SIGNATURES[table.number],
  );
}

export type ExplanationBlock =
  | { kind: "paragraph"; index: number }
  | { kind: "table"; table: ExplanationGrid };

export function explanationBlocks(article: string, paragraphs: readonly string[], excerpt?: readonly string[]) {
  let selected: Set<number> | undefined;
  if (excerpt) {
    selected = new Set<number>();
    let from = 0;
    for (const text of excerpt) {
      const index = paragraphs.indexOf(text, from);
      if (index >= 0) { selected.add(index); from = index + 1; }
    }
  }
  const tables = new Map(explanationTables(article, paragraphs).map((table) => [table.start, table]));
  const blocks: ExplanationBlock[] = [];
  for (let index = 0; index < paragraphs.length; index++) {
    const table = tables.get(index);
    if (table) {
      if (!selected || [...selected].some((i) => i >= table.start && i <= table.end))
        blocks.push({ kind: "table", table });
      index = table.end;
    } else if (!selected || selected.has(index)) blocks.push({ kind: "paragraph", index });
  }
  return blocks;
}
