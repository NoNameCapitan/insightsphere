import assert from 'node:assert/strict';
import test from 'node:test';
import { ARTICLES, SPECIALTIES } from '../lib/vlk-sample-data.ts';
import { OFFICIAL_ARTICLE_TEXTS } from '../lib/vlk-official-articles.ts';
import { articleIcdLabel, articleIcdScope, articleIcdSearchClarification, articleIcdSearchNote, searchArticles, normalizeIcdCode } from '../lib/vlk-search.ts';
import { EXPLANATION as speech } from '../lib/explanations/article-85.ts';
import { EXPLANATION as enuresis } from '../lib/explanations/article-86.ts';
const article=n=>ARTICLES.find(item=>item.article===n);
const numbers=(query,items=ARTICLES)=>searchArticles(query,{},items).map(hit=>hit.article.article);

test('all eight doctors have coded articles; neurologist includes explicitly named 85 and 86 roles',()=>{
 assert.equal(SPECIALTIES.length,8);
 for(const specialty of SPECIALTIES){const rows=ARTICLES.filter(a=>a.specialties.includes(specialty.id));assert.ok(rows.length);assert.ok(rows.some(a=>articleIcdScope(a).includedCodes.length));}
 assert.ok(speech.paragraphs.some(p=>/невропатолог/iu.test(p)));assert.ok(enuresis.paragraphs.some(p=>/невропатолог/iu.test(p)));
 assert.ok(article('85').specialties.includes('neurologist'));assert.ok(article('86').specialties.includes('neurologist'));
 const neuro=ARTICLES.filter(a=>a.specialties.includes('neurologist'));assert.equal(neuro.length,23);assert.equal(neuro.filter(a=>articleIcdScope(a).includedCodes.length).length,19);
 assert.deepEqual(numbers('F98.0',neuro),['86']);assert.deepEqual(numbers('F98.5',neuro),['85']);
});

test('article 86 search uses exact article18 enuresis cross-reference without altering raw official F98',()=>{
 assert.equal(article('86').icd,'F98');assert.equal(article('86').officialIncluded,OFFICIAL_ARTICLE_TEXTS['86'].included);
 const scope=articleIcdScope(article('86')),clarification=articleIcdSearchClarification(article('86'));assert.deepEqual(scope.includedCodes,['F98']);assert.equal(clarification.sourceArticle,'18');assert.ok(OFFICIAL_ARTICLE_TEXTS['18'].included.includes(clarification.sourceText));
 for(const q of ['F98.0','F98.00','F98.01','F98.02','F980'])assert.deepEqual(numbers(q),['86'],q);
 assert.deepEqual(numbers('F98.5'),['85']);
 for(const q of ['F98.1','F98.2','F98.3','F98.4','F98.6','F98.8','F98.9']){assert.ok(!numbers(q).includes('86'),q);assert.ok(numbers(q).includes('18'),q);}
 assert.deepEqual([...numbers('F98')].sort(),['18','85','86']);
 assert.equal(articleIcdLabel(article('86')),'F98');assert.match(articleIcdSearchNote(article('86')),/Пошук за F98\.0.*зі ст\. 18.*зазначено F98/);
 const other={...article('86'),officialIncluded:'Включено: тест J45'};assert.deepEqual(articleIcdScope(other).includedCodes,['J45']);assert.equal(articleIcdSearchClarification(other),undefined);
});

test('uncoded post-treatment rows remain uncoded with explicit display instead of invented mappings',()=>{
 const rows=ARTICLES.filter(a=>!articleIcdScope(a).includedCodes.length);assert.equal(rows.length,12);
 assert.deepEqual(rows.map(a=>a.article),['7','11','24','32','37','44','48','56','59','65','72','81']);
 for(const a of rows){assert.equal(a.icd,'—');assert.match(articleIcdLabel(a),/окремий код у Розкладі не зазначено/);assert.equal(articleIcdSearchClarification(a),undefined);}
});


test('official parenthesized ICD decimal syntax is normalized before generic punctuation handling',()=>{
 for(const q of ['F98(0)','F98 (0)','МКХ-10: F98(0)'])assert.deepEqual(numbers(q),['86'],q);
 for(const q of ['F98(5)','F98 (5)','F98 ( 5 )'])assert.deepEqual(numbers(q),['85'],q);
 assert.equal(normalizeIcdCode('F98 (0)'),'F98.0');assert.deepEqual(numbers('F45 (3)'),numbers('F45.3'));
});
