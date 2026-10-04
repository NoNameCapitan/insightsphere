import { ExternalLink } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { OutcomeBadge } from '@/components/vlk/outcome-badge';
import { EXAMINEE_TYPES } from '@/lib/vlk-session';
import { SCHEDULE_GRAPHS, type ScheduleGraph } from '@/lib/vlk-graphs';
import { GRAPH_DESCRIPTIONS, CATEGORY_SOURCE } from '@/lib/vlk-category-data';
import { CONTRACT, EDUCATION, contextProblem, resolveReviewContext, type ReviewContext } from '@/lib/vlk-review-context';
import { getPointTdv } from '@/lib/vlk-point-tdv';
import { TDV_COLUMNS } from '@/lib/vlk-tdv';
import { TDV_URL } from '@/lib/vlk-links';
import type { ArticleRule } from '@/lib/vlk-rules';

export function ReviewContextControls({ context, onChange, prefix = '' }: {
  context: ReviewContext; onChange: (next: ReviewContext) => void; prefix?: string;
}) {
  const changeCategory = (examineeType: string) => onChange({ ...context, examineeType,
    scheduleGraph: examineeType === CONTRACT && context.scheduleGraph === 'I' ? 'all' : context.scheduleGraph,
    tdvColumn: examineeType === EDUCATION && ![9, 10].includes(context.tdvColumn ?? 0) ? undefined : context.tdvColumn,
  });
  const columns = context.examineeType === EDUCATION ? TDV_COLUMNS.filter(c => [9, 10].includes(c.id)) : TDV_COLUMNS;
  return <div className="review-context-controls">
    <p className="context-hint context-map">Категорія — кого оглядаємо. Графи I–III — Розклад хвороб; ТДВ 1–12 — вимоги до призначення.</p>
    <label htmlFor={`${prefix}examinee-type`}>Категорія оглядуваного</label>
    <Select value={context.examineeType} onValueChange={changeCategory}>
      <SelectTrigger id={`${prefix}examinee-type`} className="min-h-11 w-full bg-card text-xs"><SelectValue /></SelectTrigger>
      <SelectContent>{EXAMINEE_TYPES.map(type => <SelectItem key={type} value={type}>{type}</SelectItem>)}</SelectContent>
    </Select>
    <label htmlFor={`${prefix}schedule-graph`}>Графа Розкладу хвороб</label>
    <Select value={context.scheduleGraph} onValueChange={value => onChange({ ...context, scheduleGraph: value as ScheduleGraph })}>
      <SelectTrigger id={`${prefix}schedule-graph`} aria-describedby={`${prefix}graph-distinction`} className="min-h-11 w-full bg-card text-xs">
        <SelectValue>{SCHEDULE_GRAPHS.find(item => item.id === context.scheduleGraph)?.label}</SelectValue>
      </SelectTrigger>
      <SelectContent className="graph-picker-content" position="popper" align="start">
        {SCHEDULE_GRAPHS.map(item => <SelectItem key={item.id} value={item.id} className="graph-picker-option"
          textValue={item.label} disabled={context.examineeType === CONTRACT && item.id === 'I'}>
          <span className="graph-picker-copy"><strong>{item.label}</strong>
            {item.id !== 'all' ? <span>{GRAPH_DESCRIPTIONS[item.id]}</span> : <span>Залишити без вибору, доки не звірено направлення</span>}
          </span>
        </SelectItem>)}
      </SelectContent>
    </Select>
    <p id={`${prefix}graph-distinction`} className="context-hint">Графи Розкладу I–III не є графами ТДВ 1–12.</p>
    <details className="context-help">
      <summary>Як обрати графу · №402</summary>
      {Object.entries(GRAPH_DESCRIPTIONS).map(([graph, text]) => <p key={graph}><strong>Графа {graph}.</strong> {text}</p>)}
      <p>Для контракту — графи II/III за п. 18.5; звання та посаду звіряють із направленням.</p>
      <a href={CATEGORY_SOURCE.n7414.url} target="_blank" rel="noreferrer">П. 18.5 в офіційному №402 ↗</a>
    </details>
    <details className="review-tdv-settings context-help">
      <summary>Призначення ТДВ · {context.tdvColumn ? `графа ${context.tdvColumn}` : 'не уточнено'}</summary>
      <div className="space-y-2 pb-1">
    <label htmlFor={`${prefix}tdv-column`}>{context.examineeType === EDUCATION ? 'Вступ до ВВНЗ · звання' : 'Призначення за направленням · ТДВ'}</label>
    <Select value={String(context.tdvColumn ?? 'none')} onValueChange={value => onChange({ ...context, tdvColumn: value === 'none' ? undefined : Number(value) })}>
      <SelectTrigger id={`${prefix}tdv-column`} className="min-h-11 w-full bg-card text-xs"><SelectValue placeholder="Не уточнено" /></SelectTrigger>
      <SelectContent className="tdv-context-picker" position="popper" align="start"><SelectItem value="none">Не уточнено</SelectItem>{columns.map(c => <SelectItem key={c.id} value={String(c.id)} className="whitespace-normal">
        {context.examineeType === EDUCATION ? (c.id === 9 ? 'Без офіцерського звання · ТДВ 9' : 'Офіцерське звання · ТДВ 10') : `${c.id}. ${c.label}`}
      </SelectItem>)}</SelectContent>
    </Select>
    <p className="context-hint">Норми для категорії показано окремо від загальної придатності. Рішення приймає ВЛК.</p>
      </div>
    </details>
    {contextProblem(context) ? <p role="alert" className="context-warning">{contextProblem(context)}</p> : null}
  </div>;
}

export function ReviewContextResult({ article, rule, context }: { article: string; rule: ArticleRule; context: ReviewContext }) {
  const result = resolveReviewContext(article, rule, context);
  const categorySpecific = context.examineeType === CONTRACT || context.examineeType === EDUCATION || !!contextProblem(context);
  const column = TDV_COLUMNS.find(c => c.id === context.tdvColumn);
  const tdv = getPointTdv(article, rule.point);
  const mark = column ? tdv?.marks[column.id] : undefined;
  return <div className="normative-context-result" data-context-result aria-live="polite">
    {categorySpecific ? <section className="context-category-result">
      <p className="context-eyebrow">{result.scope} · не рішення ВЛК</p>
      <OutcomeBadge outcome={result.outcome} label={result.label} />
      <p className="mt-2 text-sm font-semibold leading-6">{result.outcome}</p>
      {result.note ? <p className="mt-1 text-xs leading-5">{result.note}</p> : null}
      <a className="context-source" href={result.sourceUrl} target="_blank" rel="noreferrer">{result.basis} <ExternalLink className="size-3" aria-hidden="true" /></a>
      {result.quote ? <details className="context-help"><summary>Підстава · дослівно з №402</summary><p className="vlk-normative">{result.quote}</p></details> : null}
    </section> : null}
    {column ? <section className="context-tdv-result" data-tdv-context={column.id}>
      <p className="context-eyebrow">ТДВ · графа {column.id} · окрема вимога до призначення</p>
      <p className="text-xs leading-5">{column.label}</p>
      <p className="mt-1 text-sm font-semibold">{mark ? `Позначка №402: ${mark}` : 'Позначки в цьому рядку немає'}</p>
      <p className="text-xs leading-5">{mark === 'НП' ? 'Обмеження стосується зазначеного призначення; це не загальна непридатність до військової служби.' : mark ? 'Умовну позначку застосовують лише до зазначеної в ній посади або чинника.' : 'Відсутність позначки не підтверджує придатність. Звірте загальні показники ТДВ та пояснення.'}</p>
      <a className="context-source" href={TDV_URL} target="_blank" rel="noreferrer">Додаток 3 · офіційне джерело <ExternalLink className="size-3" aria-hidden="true" /></a>
    </section> : null}
  </div>;
}
