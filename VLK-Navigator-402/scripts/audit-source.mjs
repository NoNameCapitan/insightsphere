// Usage: node scripts/audit-source.mjs /path/to/downloaded-official.html
// Read-only audit; no writes to normative modules and no automatic acceptance.
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { OFFICIAL_ARTICLE_TEXTS } from '../lib/vlk-official-articles.ts';
import { ARTICLE_RULES } from '../lib/vlk-rules.ts';
import { loadArticleExplanation } from '../lib/vlk-explanations.ts';
import { detectOfficialEdition } from '../lib/vlk-edition-monitor.ts';
import { EDITION } from '../lib/vlk-sample-data.ts';

const source = process.argv[2];
if (!source) throw new Error('Provide the downloaded official HTML path');
const html = readFileSync(source, 'utf8');
if (detectOfficialEdition(html) !== EDITION) throw new Error('Edition differs or cannot be confirmed; stop for manual review');
const fragments = [];
for (const [article, data] of Object.entries(OFFICIAL_ARTICLE_TEXTS)) {
  fragments.push({ article, kind: 'included', text: data.included });
  for (const rule of ARTICLE_RULES[article] ?? []) {
    fragments.push({ article, kind: `condition:${rule.point}`, text: rule.condition });
    fragments.push({ article, kind: `outcome:${rule.point}`, text: rule.outcome });
  }
  const explanation = await loadArticleExplanation(article);
  for (const [index, text] of (explanation?.paragraphs ?? []).entries()) fragments.push({ article, kind: `explanation:${index}`, text });
}
const result = spawnSync('python3', [fileURLToPath(new URL('./audit-source.py', import.meta.url)), source], {
  input: JSON.stringify(fragments), encoding: 'utf8', maxBuffer: 4 * 1024 * 1024,
});
if (result.error) throw result.error;
process.stdout.write(result.stdout); process.stderr.write(result.stderr); process.exitCode = result.status ?? 1;
