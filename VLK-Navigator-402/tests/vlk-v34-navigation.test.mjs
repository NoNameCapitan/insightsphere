import assert from 'node:assert/strict';
import test from 'node:test';
import { ARTICLES, SPECIALTIES } from '../lib/vlk-sample-data.ts';
import { readArticleUsage, readPinnedArticles, recordArticleOpen, frequentArticles, togglePinned, specialtyQuickArticles, ARTICLE_USAGE_KEY, PINNED_ARTICLES_KEY } from '../lib/vlk-article-usage.ts';
import { clearStoredSession } from '../lib/vlk-local-storage.ts';
import { relatedArticles, ARTICLE_CROSS_REFERENCES, ARTICLE_GROUPS } from '../lib/vlk-article-relations.ts';
import { getPointTdv } from '../lib/vlk-point-tdv.ts';
import { TDV_RULES } from '../lib/vlk-tdv.ts';
import { EXPLANATION_ARTICLES, loadArticleExplanation, EXPLANATION_DIGEST } from '../lib/vlk-explanations.ts';
import { articleExplanationParagraphs } from '../lib/vlk-explanation-view.ts';
import { explanationSections, explanationPlainText } from '../lib/vlk-explanation-sections.ts';
import { explanationBlocks } from '../lib/vlk-explanation-tables.ts';
import { searchArticles } from '../lib/vlk-search.ts';
import { OFFICIAL_ARTICLE_TEXTS } from '../lib/vlk-official-articles.ts';
import { parseArticleReferences } from '../lib/vlk-article-reference-parser.ts';

test('article openings count only explicit transitions; pin order and frequency survive reload', () => {
  let usage=recordArticleOpen({}, '49', undefined, 100);
  assert.equal(recordArticleOpen(usage, '49', '49', 101),usage);
  assert.equal(recordArticleOpen(usage, '999', '49'),usage);
  usage=recordArticleOpen(usage,'50','49',102);
  usage=recordArticleOpen(usage,'49','50',103);
  assert.equal(usage['49'].opens,2);
  assert.deepEqual(frequentArticles(usage,[]),['49','50']);
  const pins=togglePinned([], '50');
  assert.deepEqual(frequentArticles(usage,pins),['50','49']);
  assert.deepEqual(frequentArticles({},pins),['50'],'Clearing counts retains pins');
  assert.deepEqual(togglePinned(pins,'50'),[]);
  assert.deepEqual(readArticleUsage(JSON.stringify({version:1,items:usage})),usage);
  assert.deepEqual(readPinnedArticles(JSON.stringify({version:1,articles:pins})),pins);
});

test('corrupt, foreign and prototype-like local entries cannot create articles or break startup', () => {
  for(const value of [null,'{broken',[],{version:2,items:{}}]) assert.deepEqual(readArticleUsage(value),{});
  assert.deepEqual(readArticleUsage({version:1,items:{49:{opens:-1,lastOpenedAt:100},50:{opens:2.5,lastOpenedAt:100},51:{opens:2,lastOpenedAt:-1},999:{opens:5,lastOpenedAt:100}}}),{});
  assert.deepEqual(readPinnedArticles({version:1,articles:['49','49','constructor','999',50]}),['49']);
});

test('ending session clears new preferences and counts without touching theme or other apps', () => {
  const map=new Map([[ARTICLE_USAGE_KEY,'usage'],[PINNED_ARTICLES_KEY,'pins'],['theme','dark'],['other','safe']]);
  const store={getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)};
  assert.equal(clearStoredSession(store),true);
  assert.equal(map.has(ARTICLE_USAGE_KEY),false);assert.equal(map.has(PINNED_ARTICLES_KEY),false);
  assert.equal(map.get('theme'),'dark');assert.equal(map.get('other'),'safe');
});

test('all specialty starter lists contain existing articles from that specialty', () => {
  for(const specialty of SPECIALTIES){const ids=specialtyQuickArticles(specialty.id);assert.ok(ids.length>=8 && ids.length<=10,specialty.id);
    assert.equal(new Set(ids).size,ids.length);
    for(const id of ids) assert.ok(ARTICLES.some(a=>a.article===id&&a.specialties.includes(specialty.id)));
  }
});

test('related navigation has no self-link, duplicate or invented article and covers verified groups', async () => {
  for(const article of ARTICLES){const links=relatedArticles(article.article);assert.ok(links.length<=Math.max(6, (ARTICLE_CROSS_REFERENCES[article.article]??[]).length));
    assert.ok(links.every(r=>r.article.article!==article.article&&r.reason.length));
    assert.equal(new Set(links.map(r=>r.article.article)).size,links.length);
    assert.equal(ARTICLE_GROUPS.filter(g=>Number(article.article)>=g.from&&Number(article.article)<=g.to).length,1);
  }
  // v38 includes literal Schedule exclusions as well as explanation references;
  // verify both directions of coverage for all 87 sources, not only known links.
  for(const {article: from} of ARTICLES){
    const paragraphs=[OFFICIAL_ARTICLE_TEXTS[from].included,...articleExplanationParagraphs(await loadArticleExplanation(from))];
    const mentions=[...new Set(paragraphs.flatMap(text=>parseArticleReferences(text,from).map(item=>item.article)))].sort();
    const targets=[...(ARTICLE_CROSS_REFERENCES[from]??[])].sort();
    assert.deepEqual(targets,mentions,`${from}: every literal reference and no invented target`);
    assert.deepEqual(relatedArticles(from,1).filter(item=>item.kind==='reference').map(item=>item.article.article).sort(),targets,`${from}: compact limit must retain all source links`);
  }
  assert.deepEqual(relatedArticles('999'),[]);
});

test('ТДВ preserves exact-point and whole-article scope without borrowing a sibling point', () => {
  assert.equal(getPointTdv('49','в').scope,'article');assert.equal(getPointTdv('49','в').sourceRowKey,'49');
  assert.deepEqual(getPointTdv('49','в').marks,TDV_RULES['49']);
  assert.equal(getPointTdv('47','в').scope,'point');assert.equal(getPointTdv('47','в').sourceRowKey,'47-в');
  assert.equal(getPointTdv('47','а'),null);assert.equal(getPointTdv('constructor','в'),null);
});

test('collapsing explanations loses no fragment, never splits a table, and copying includes closed sections', async () => {
  for(const article of EXPLANATION_ARTICLES){
    const source=await loadArticleExplanation(article);const before=JSON.stringify(source);
    const paragraphs=articleExplanationParagraphs(source);const sections=explanationSections(article,paragraphs);
    assert.deepEqual(sections.flatMap(s=>s.blocks),explanationBlocks(article,paragraphs),article);
    assert.deepEqual(sections.flatMap(s=>s.indices),paragraphs.map((_,i)=>i),article);
    for(const section of sections)if(section.blocks.some(b=>b.kind==='table'))assert.equal(section.blocks.length,1);
    const copied=explanationPlainText(article,paragraphs);
    for(const paragraph of paragraphs)assert.ok(copied.includes(paragraph),`${article}: missing literal fragment`);
    assert.equal(JSON.stringify(source),before);
  }
  assert.equal(EXPLANATION_DIGEST,'245ae5d143a50b2d3ebfb29851e454ae38038f582a96a3c6a4d91af0b3bfdb16');
});

test('Невропатолог is the display label, stable IDs and the old search spelling still work', () => {
  assert.equal(SPECIALTIES.find(s=>s.id==='neurologist').label,'Невропатолог');
  const ids=q=>searchArticles(q).map(h=>h.article.article).sort();
  assert.deepEqual(ids('невропатолог'),ids('невролог'));
  for(const q of ['БА','J45','J45.0','J45-J46','бронхіальна астма середньої тяжкості','легка персистуюча астма','бронхіальн астм'])assert.equal(searchArticles(q)[0].article.article,'47',q);
});
