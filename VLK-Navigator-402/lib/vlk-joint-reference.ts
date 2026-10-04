/** Read-only presentation of verified Table 14 fragments. No angle conversion or severity classification. */
import { EXPLANATION } from './explanations/article-61.ts';
import { explanationTables } from './vlk-explanation-tables.ts';
const table = explanationTables('61', EXPLANATION.paragraphs).find(item => item.number === 14);
let joint = '';
export const JOINT_REFERENCES = (table?.body ?? []).map((row, index) => {
  const cells = row.map(cell => cell.indices.map(i => EXPLANATION.paragraphs[i]).join(' '));
  if (cells.length === 6) joint = cells.shift() ?? '';
  return { id: String(index), joint, movement: cells[0], normal: cells[1], slight: cells[2], moderate: cells[3], significant: cells[4] };
});
export const JOINT_REFERENCE_SOURCE = 'https://zakon.rada.gov.ua/laws/show/z1109-08/ed20250822#n6836';
