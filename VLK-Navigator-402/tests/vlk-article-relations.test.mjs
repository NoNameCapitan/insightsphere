import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import { ARTICLES } from '../lib/vlk-sample-data.ts';
import { OFFICIAL_ARTICLE_TEXTS } from '../lib/vlk-official-articles.ts';
import { loadArticleExplanation } from '../lib/vlk-explanations.ts';
import { articleExplanationParagraphs } from '../lib/vlk-explanation-view.ts';
import { parseArticleReferences } from '../lib/vlk-article-reference-parser.ts';
import { ARTICLE_GROUPS, ARTICLE_CROSS_REFERENCES, relatedArticles, contextReferences, evidenceQuote, groupArticles } from '../lib/vlk-article-relations.ts';

const audit = JSON.parse(fs.readFileSync(new URL('../review/article-relations-audit.json', import.meta.url), 'utf8'));
const sorted = values => [...new Set(values)].sort((a, b) => Number(a) - Number(b));

test('article reference parser distinguishes lists, alternatives and ranges from ICD, sections and self headings', () => {
  const targets = value => parseArticleReferences(value, '11').map(item => item.article);
  assert.deepEqual(targets('4. Стаття 11: за пунктами «а», «б» чи «в» статей 8, 9, 10 Розкладу хвороб.'), ['8', '9', '10']);
  assert.deepEqual(targets('статті 8 або 10; статтею 31; статтями 60–62 та 65.'), ['8', '10', '31', '60', '61', '62', '65']);
  assert.deepEqual(targets('таблиці 13 статті 46 додатку 2; МКХ J45-J46; графи I-III; пункту 20.3; наказу №402'), ['46']);
  assert.deepEqual(targets('За відповідними статтями Розкладу хвороб; статті 402; статті 20.3; статті 0; статті 88; статті 80–90.'), []);
  assert.deepEqual(targets('статті 87'), ['87']);
});

test('all 87 articles and explanations yield exactly the independently audited 47 directed links', async () => {
  let edges = 0;
  let mentions = 0;
  for (const article of ARTICLES) {
    const number = article.article;
    const explanation = await loadArticleExplanation(number);
    const paragraphs = articleExplanationParagraphs(explanation);
    const parsed = [...parseArticleReferences(OFFICIAL_ARTICLE_TEXTS[number].included, number), ...paragraphs.flatMap(paragraph => parseArticleReferences(paragraph, number))];
    const expected = sorted(parsed.map(item => item.article));
    assert.deepEqual(expected, audit.directMap[number] ?? [], `Independent audit differs at ${number}`);
    assert.deepEqual(sorted(ARTICLE_CROSS_REFERENCES[number] ?? []), expected, `Missing or invented links at ${number}`);
    // Even limit1 must preserve every direct link, including same-group links.
    const direct = relatedArticles(number, 1).filter(item => item.kind === 'reference');
    assert.deepEqual(sorted(direct.map(item => item.article.article)), expected, `Direct links truncated at ${number}`);
    edges += direct.length;
    for (const link of direct) {
      assert.ok(link.evidence.length, `${number}→${link.article.article}: missing evidence`);
      for (const evidence of link.evidence) {
        const quote = evidenceQuote(number, evidence, paragraphs);
        assert.ok(quote, `${number}→${link.article.article}: empty literal evidence`);
        assert.ok(parseArticleReferences(quote, number).some(item => item.article === link.article.article));
        const fixture = audit.directEvidence.find(item => item.source === number && item.target === link.article.article && item.kind === (evidence.source === 'schedule' ? 'included-excluded' : 'explanation') && item.paragraphIndex === evidence.paragraphIndex);
        assert.ok(fixture, `${number}→${link.article.article}: evidence not independently inventoried`);
        assert.equal(quote, fixture.quote);
        assert.deepEqual(evidence.contextParagraphIndices ?? [], fixture.contextParagraphIndices ?? []);
        assert.deepEqual((evidence.contextParagraphIndices ?? []).map(index => paragraphs[index]), fixture.contextQuotes ?? []);
        assert.match(evidence.sourceUrl, /^https:\/\/zakon\.rada\.gov\.ua\/laws\/show\/z1109-08\/ed20250822#/u);
        mentions += 1;
      }
    }
  }
  assert.equal(edges, 47);
  assert.equal(mentions, 56);
  assert.equal(Object.keys(ARTICLE_CROSS_REFERENCES).length, 31);
});

test('direct links precede fallback, deduplicate targets and retain every conditional source passage', () => {
  for (const article of ARTICLES) {
    const links = relatedArticles(article.article, 5);
    assert.equal(new Set(links.map(item => item.article.article)).size, links.length);
    let foundGroup = false;
    for (const link of links) {
      if (link.kind === 'group') foundGroup = true;
      else assert.equal(foundGroup, false, `Direct source hidden after generic group at ${article.article}`);
    }
  }
  assert.equal(relatedArticles('8')[0].article.article, '11');
  assert.equal(relatedArticles('8')[0].evidence.length, 2);
  const source79 = relatedArticles('79', 1);
  assert.equal(source79.find(item => item.article.article === '35').evidence.length, 3);
  assert.equal(source79.find(item => item.article.article === '36').evidence.length, 3);
  assert.deepEqual(relatedArticles('11', 1).map(item => item.article.article), ['8', '9', '10']);
  assert.deepEqual(relatedArticles('72', 1)[0].evidence[0].targetPoints, ['а']);
  assert.deepEqual(relatedArticles('11', 1)[0].evidence[0].targetPoints, ['а', 'б', 'в']);
  assert.deepEqual(relatedArticles('51', 1).find(item => item.article.article === '56').evidence[0].contextParagraphIndices, [13]);
  assert.deepEqual(relatedArticles('60', 1).find(item => item.article.article === '61').evidence[0].contextParagraphIndices, [1]);
});

test('literal exclusions are identified separately and never labelled as interchangeable similar diagnoses', () => {
  const exclusions = {10:['9'],16:['17'],17:['84'],18:['85','86'],22:['41'],49:['50','51'],61:['62'],64:['60']};
  for (const [number, targets] of Object.entries(exclusions)) {
    const links = relatedArticles(number, 1);
    for (const target of targets) {
      const link = links.find(item => item.article.article === target);
      assert.ok(link);
      assert.match(link.reason, /Виключено з цієї статті/u);
      assert.ok(link.evidence.every(item => item.source === 'schedule' && item.relation === 'exclusion'));
    }
  }
  assert.ok(relatedArticles('61', 1).find(item => item.article.article === '65').evidence.every(item => item.relation === 'reference'));
});

test('all unnumbered referrals retain exact conditions and remain group navigation, including TB after recovery', async () => {
  let count = 0;
  const sourceNumbers = new Set();
  for (const number of ARTICLES.map(article => article.article)) {
    const paragraphs = articleExplanationParagraphs(await loadArticleExplanation(number));
    const contextual = contextReferences(number, paragraphs);
    const generic = audit.genericEvidence.filter(item => item.source === number);
    const implicit = audit.implicitUnderlyingDiseaseParagraphs.filter(item => item.source === number);
    const genericPattern = /(?:відповідн[\p{L}]*|інш[\p{L}]*|основн[\p{L}]*)\s+[сc]тат|статт[\p{L}]*\s+Розкладу хвороб,\s+які|статтею Розкладу хвороб,\s+яка/iu;
    const scannedIndices = paragraphs.flatMap((paragraph, index) => genericPattern.test(paragraph) ? [index] : []);
    assert.deepEqual(scannedIndices, generic.map(item => item.paragraphIndex), `${number}: unnumbered referral missing from the audit`);
    for (const evidence of implicit) assert.equal(evidence.quote, paragraphs[evidence.paragraphIndex], `${number}: underlying-disease evidence must be literal`);
    assert.deepEqual(contextual.map(item => item.paragraphIndex).sort((a,b)=>a-b), [...generic,...implicit].map(item => item.paragraphIndex).sort((a,b)=>a-b));
    for (const context of contextual) {
      assert.equal(context.quote, paragraphs[context.paragraphIndex]);
      assert.ok(context.quote.length > 0);
      assert.ok(context.groupIds.length > 0);
      for (const id of context.groupIds) assert.ok(ARTICLE_GROUPS.some(group => group.id === id));
      assert.equal('targets' in context, false, 'Unnamed articles must not become inferred direct target numbers');
      sourceNumbers.add(number);
      count += 1;
    }
  }
  assert.equal(count, 31);
  assert.equal(sourceNumbers.size, 30);
  for (const number of ['12', '22', '23', '38', '39']) {
    const contexts = contextReferences(number);
    assert.ok(contexts.length);
    assert.deepEqual(contexts[0].groupIds, ARTICLE_GROUPS.map(group => group.id), `${number}: unspecified underlying disease must not infer a target`);
  }
  const tbParagraphs = articleExplanationParagraphs(await loadArticleExplanation('2'));
  const tb = contextReferences('2', tbParagraphs)[0];
  assert.equal(tb.quote, tbParagraphs[1]);
  assert.match(tb.quote, /У разі виходу захворювання в одужання після проведеного курсу лікування/u);
  assert.match(tb.quote, /анатомічну зону ураження/u);
  assert.equal(relatedArticles('2').some(item => item.kind === 'reference'), false);
  assert.deepEqual(tb.groupIds, ARTICLE_GROUPS.map(group => group.id));
  // A real Latin c in article25's cтаттями must remain covered by the audit.
  assert.ok(contextReferences('25').some(item => item.paragraphIndex === 18));
  // Loading never falls back to another article's or generated normative text.
  assert.equal(contextReferences('2')[0].quote, '');
});

test('underlying-disease referrals are covered while documentation, etiology descriptions and deleted clauses create no links', async () => {
  const underlying = /(?:експертне рішення|медичний огляд)[^.]*?(?:основн(?:ій|ого|им)[^.]*?(?:захворювання|формі)|щодо захворювань, які призвели)/iu;
  for (const {article: number} of ARTICLES) {
    const paragraphs = articleExplanationParagraphs(await loadArticleExplanation(number));
    const contexts = contextReferences(number, paragraphs);
    for (const [index, paragraph] of paragraphs.entries()) {
      if (underlying.test(paragraph)) assert.ok(contexts.some(context => context.paragraphIndex === index), `${number}:${index}: underlying-disease referral missing`);
    }
  }
  for (const item of audit.reviewedNonReferralMentions) assert.equal(contextReferences(item.source).some(context => context.paragraphIndex === item.paragraphIndex), false);
  assert.equal(contextReferences('22').some(context => context.paragraphIndex === 11), false, 'Deleted amendment is not an article referral');
});

test('all navigation groups are complete, exclude the current article and reject unknown inputs', () => {
  assert.deepEqual(sorted(ARTICLE_GROUPS.flatMap(group => groupArticles(group.id).map(article => article.article))), sorted(ARTICLES.map(article => article.article)));
  for (const article of ARTICLES) {
    for (const group of ARTICLE_GROUPS) assert.equal(groupArticles(group.id, article.article).some(item => item.article === article.article), false);
  }
  for (const unknown of ['999','constructor','__proto__']) {
    assert.deepEqual(relatedArticles(unknown), []);
    assert.deepEqual(contextReferences(unknown), []);
    assert.deepEqual(groupArticles(unknown), []);
  }
});
