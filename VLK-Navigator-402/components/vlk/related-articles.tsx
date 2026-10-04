import { useState } from 'react';
import { ArrowUpRight } from 'lucide-react';
import {
  ARTICLE_GROUPS, contextReferences, evidenceQuote, groupArticles, relatedArticles,
  type RelatedArticle,
} from '@/lib/vlk-article-relations';
import { EXPLANATION_META, EXPLANATION_SOURCE_URL } from '@/lib/vlk-explanations';
import { explanationUrl } from '@/lib/vlk-links';
import type { VlkArticle } from '@/lib/vlk-sample-data';

type Props = {
  article: string;
  paragraphs: readonly string[];
  explanationState: 'loading' | 'ready' | 'error';
  onOpen: (article: VlkArticle) => void;
};

function ArticleLink({ article, reason, onOpen }: {
  article: VlkArticle; reason?: string; onOpen: Props['onOpen'];
}) {
  return <button type="button" data-related-article={article.article} onClick={() => onOpen(article)}>
    <span className="quick-number">{article.article}</span>
    <span className="min-w-0 flex-1">
      <span className="quick-title">{article.title}</span>
      {reason ? <span className="quick-meta">{reason}</span> : null}
    </span>
    <ArrowUpRight className="size-4 shrink-0" aria-hidden="true" />
  </button>;
}

function ReferenceList({ items, article, paragraphs, explanationState, onOpen }: Props & { items: RelatedArticle[] }) {
  return <ul className="related-direct-list">{items.map(item => <li key={item.article.id} data-related-kind="reference">
    <ArticleLink article={item.article} reason={item.reason} onOpen={onOpen} />
    <details className="related-evidence">
      <summary>Підстава у №402{item.evidence.length > 1 ? ` · фрагментів: ${item.evidence.length}` : ''}</summary>
      {item.evidence.map((evidence, index) => {
        const quote = evidenceQuote(article, evidence, paragraphs);
        return <div className="related-quote" key={`${evidence.source}-${evidence.paragraphIndex ?? 'included'}-${index}`}>
          {evidence.contextParagraphIndices?.map(paragraphIndex => paragraphs[paragraphIndex] ? <div key={paragraphIndex}>
            <p className="related-source-label">Попередній фрагмент пояснення · дослівно</p>
            <blockquote>{paragraphs[paragraphIndex]}</blockquote>
          </div> : null)}
          <p className="related-source-label">{evidence.source === 'schedule' ? 'Розклад хвороб · «Включено / Виключено»' : 'Офіційне пояснення'} · дослівно</p>
          {quote ? <blockquote>{quote}</blockquote> : <p role="status">{explanationState === 'loading' ? 'Завантажуємо дослівну підставу…' : 'Підстава доступна в офіційному джерелі.'}</p>}
          <a className="context-source" href={evidence.sourceUrl} target="_blank" rel="noreferrer">Джерело посилання · ст. {article} ↗</a>
        </div>;
      })}
    </details>
  </li>)}</ul>;
}

export function RelatedArticles({ article, paragraphs, explanationState, onOpen }: Props) {
  const [groupId, setGroupId] = useState('');
  const related = relatedArticles(article, 5);
  const direct = related.filter(item => item.kind === 'reference');
  const similar = related.filter(item => item.kind === 'group');
  const contexts = contextReferences(article, paragraphs);
  const suggestedGroups = new Set(contexts.flatMap(item => item.groupIds));
  const contextualGroups = ARTICLE_GROUPS.filter(group => suggestedGroups.has(group.id));
  const otherGroups = ARTICLE_GROUPS.filter(group => !suggestedGroups.has(group.id));
  const selectedGroupArticles = groupArticles(groupId, article);
  const sourceUrl = explanationUrl(EXPLANATION_META[article]?.anchor, EXPLANATION_SOURCE_URL);

  // Retain the existing category/graph/TDV navigation; focus after React commits.
  function openArticle(item: VlkArticle) {
    onOpen(item);
    requestAnimationFrame(() => document.getElementById('vlk-article-heading')?.focus({ preventScroll: true }));
  }

  if (!related.length && !contexts.length) return null;
  return <details className="related-articles">
    <summary>Схожі / суміжні статті <span>{direct.length ? `Прямі посилання: ${direct.length}` : contexts.length ? 'За органом / системою' : similar.length}</span></summary>
    {direct.length ? <section className="related-section" aria-label="Прямі посилання з №402">
      <h3>Прямі посилання з №402</h3>
      <p className="quick-description">Умови переходу збережені в дослівній підставі. Посилання не означає автоматичного застосування іншої статті.</p>
      <ReferenceList items={direct} article={article} paragraphs={paragraphs} explanationState={explanationState} onOpen={openArticle} />
    </section> : null}

    {contexts.length ? <section className="related-section related-by-system" aria-label="Навігація за органом або захворюванням">
      <h3>За ураженим органом або основним захворюванням</h3>
      {contexts.map(context => <details className="related-context" key={context.id} open={contexts.length === 1}>
        <summary>{contexts.length === 1 ? 'Коли переглядати інші статті' : `Умова переходу · фрагмент ${context.paragraphIndex + 1}`}</summary>
        <div className="related-quote">
          <p className="related-source-label">Офіційне пояснення · дослівно</p>
          {context.quote ? <blockquote>{context.quote}</blockquote> : <p role="status">{explanationState === 'loading' ? 'Завантажуємо умову переходу…' : 'Умову переходу перевірте в офіційному джерелі.'}</p>}
          <a className="context-source" href={sourceUrl} target="_blank" rel="noreferrer">Пояснення до ст. {article} у №402 ↗</a>
        </div>
      </details>)}
      <p className="quick-description" id={`related-context-help-${article}`}>Для переходу за органом або основним захворюванням точного номера не зазначено. Нижче — навігація по групах хвороб; відповідність стану та пункт обирає лікар.</p>
      <label className="related-group-label" htmlFor={`related-group-${article}`}>Орган / система або група хвороб</label>
      <select id={`related-group-${article}`} value={groupId} onChange={event => setGroupId(event.target.value)} aria-describedby={`related-context-help-${article}`}>
        <option value="">Оберіть групу для перегляду статей</option>
        {contextualGroups.map(group => <option value={group.id} key={group.id}>{group.label} · {group.from === group.to ? group.from : `${group.from}–${group.to}`}</option>)}
        {otherGroups.length ? <optgroup label="Інші групи хвороб">{otherGroups.map(group => <option value={group.id} key={group.id}>{group.label} · {group.from === group.to ? group.from : `${group.from}–${group.to}`}</option>)}</optgroup> : null}
      </select>
      <p className="related-group-status" role="status" aria-live="polite">{groupId ? `Статей для перегляду: ${selectedGroupArticles.length}. Нормативний результат не змінено.` : ''}</p>
      {groupId ? <ul data-related-group={groupId}>{selectedGroupArticles.map(item => <li key={item.id}>
        <ArticleLink article={item} onOpen={openArticle} />
      </li>)}</ul> : null}
    </section> : null}

    {similar.length ? <section className="related-section" aria-label="Статті тієї самої групи">
      <h3>Та сама група хвороб</h3>
      <p className="quick-description">{similar[0].reason}. Навігаційна добірка, без прямого посилання на ці статті.</p>
      <ul>{similar.map(item => <li key={item.article.id}><ArticleLink article={item.article} onOpen={openArticle} /></li>)}</ul>
    </section> : null}
  </details>;
}
