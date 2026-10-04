"use client";

import { useMemo, useRef, useState, type Dispatch, type RefObject, type SetStateAction } from 'react';
import { AlertTriangle, ArrowRight, Check, ChevronDown, CircleHelp, ExternalLink, Plus, RotateCcw, ShieldAlert, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogClose, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { OutcomeBadge } from '@/components/vlk/outcome-badge';
import { ReviewContextControls } from '@/components/vlk/review-context';
import { type ReviewContext } from '@/lib/vlk-review-context';
import { caseScheduleOutcomes, scopeCaseDestination } from '@/lib/vlk-case-schedule';
import { VlkDialogContent } from '@/components/vlk/dialog-content';
import { ARTICLES, EDITION } from '@/lib/vlk-sample-data';
import { ARTICLE_RULES } from '@/lib/vlk-rules';
import { TDV_DOCX_URL, TDV_URL, officialRuleUrl } from '@/lib/vlk-links';
import { addCasePoints, casePointKey, casePointLabel, emptyCaseDraft,
  evaluateCase, parseCaseMeasurement, parseCasePoints, type CaseDraft, type CaseFinding } from '@/lib/vlk-case';
import { CASE_DESTINATIONS, CASE_RESULT_GROUPS, caseCardView, caseRowReason, type CasePrompt } from '@/lib/vlk-case-presentation';

const FINDING_LABELS: Record<CaseFinding['kind'], string> = {
  restriction: 'Обмеження', conditional: 'Умова', 'not-applicable': 'Умова не застосована',
  'blank-cell': 'Порожня клітинка', 'no-row': 'Немає рядка', 'outside-bound': 'Поза числовою межею',
  'within-bound': 'У межах показника', 'missing-measurement': 'Потрібен показник',
  'invalid-measurement': 'Помилка введення', 'no-bound': 'Межу не зазначено', 'invalid-point': 'Непідтверджений пункт',
};
const TONE_ICONS = { restriction: ShieldAlert, attention: AlertTriangle, neutral: CircleHelp, checked: Check };

export function CaseDialog({ open, onOpenChange, draft, onChange, returnFocusRef, reviewContext = { examineeType: 'Військовозобов’язаний', scheduleGraph: 'all' }, onReviewContextChange }: {
  open: boolean; onOpenChange: (open: boolean) => void; draft: CaseDraft;
  onChange: Dispatch<SetStateAction<CaseDraft>>; returnFocusRef: RefObject<HTMLElement | null>;
  reviewContext?: ReviewContext; onReviewContextChange?: (context: ReviewContext) => void;
}) {
  const [entry, setEntry] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const [notice, setNotice] = useState('');
  const [clearPending, setClearPending] = useState(false);
  const [expandedColumn, setExpandedColumn] = useState<number | null>(null);
  const entryRef = useRef<HTMLInputElement>(null);
  const reviewContextRef = useRef<HTMLDetailsElement>(null);

  const dialogRef = useRef<HTMLDivElement>(null);
  const parsed = useMemo(() => entry.trim() ? parseCasePoints(entry) : { points: [], errors: [] }, [entry]);
  // Valid whole input previews immediately. Invalid input never contributes partial evidence.
  const previewDraft = useMemo(() => ({ ...draft, points: addCasePoints(draft.points, parsed.points) }), [draft, parsed.points]);
  const previewCount = previewDraft.points.length - draft.points.length;
  const columns = useMemo(() => evaluateCase(previewDraft), [previewDraft]);
  const schedule = useMemo(() => caseScheduleOutcomes(previewDraft.points, reviewContext), [previewDraft.points, reviewContext]);
  const cards = useMemo(() => columns.map(column => scopeCaseDestination(caseCardView(column, previewDraft), schedule)), [columns, previewDraft, schedule]);
  const height = parseCaseMeasurement(draft.height), weight = parseCaseMeasurement(draft.weight);
  const hasCriteria = previewDraft.points.length > 0 || !!draft.height.trim() || !!draft.weight.trim();
  const repeatedArticles = previewDraft.points.filter((point, index) => previewDraft.points.findIndex(p => p.article === point.article) !== index).map(p => p.article);
  const hasDriverCondition = columns.some(column => column.findings.some(f => f.mark === 'водії - НП'));
  const hasFactorCondition = columns.some(column => column.findings.some(f => f.mark === 'КРП-НП'));
  const hasData = draft.points.length > 0 || !!draft.height || !!draft.weight || draft.vehicleRole !== 'unknown' || draft.harmfulFactor !== 'unknown' || !!entry;

  function addEnteredPoints(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = parseCasePoints(entry);
    setErrors(result.errors); setNotice('');
    if (result.errors.length) return;
    const added = addCasePoints(draft.points, result.points).length - draft.points.length;
    onChange(current => ({ ...current, points: addCasePoints(current.points, result.points) }));
    setEntry(''); setNotice(added ? `Додано позицій: ${added}.` : 'Ці позиції вже є у випадку.');
    entryRef.current?.focus();
  }
  function clearCase() {
    onChange(emptyCaseDraft()); setEntry(''); setErrors([]); setNotice('Випадок очищено.'); setClearPending(false); setExpandedColumn(null);
    entryRef.current?.focus();
  }
  function focusInput(target: CasePrompt['target']) {
    const field = dialogRef.current?.querySelector<HTMLInputElement | HTMLSelectElement>(`#case-${target}`);
    field?.focus();
  }

  return <Dialog open={open} onOpenChange={onOpenChange}>
    <VlkDialogContent variant="reader" showCloseButton={false} returnFocusRef={returnFocusRef}
      className="case-dialog" onOpenAutoFocus={event => { event.preventDefault(); entryRef.current?.focus(); }}>
      <DialogHeader className="case-heading">
        <div><DialogTitle>Випадок <span>· статті та призначення</span></DialogTitle>
          <DialogDescription>Введіть пункти → звірте Розклад і ТДВ. Кольори мають підпис; точні підстави — за натисканням.</DialogDescription></div>
        <DialogClose asChild><Button variant="ghost" size="icon" className="min-h-11 min-w-11 shrink-0" aria-label="Закрити випадок"><X /></Button></DialogClose>
      </DialogHeader>
      <div className="case-layout" ref={dialogRef}>
        <section className="case-inputs" aria-label="Дані випадку">
          <div className="case-composer">
            <form onSubmit={addEnteredPoints} className="case-entry-form">
              <label htmlFor="case-points">Статті та пункти</label>
              <p id="case-entry-hint" className="case-hint">Наприклад: 39б, 40в, 13в, 28б. Результат одразу; Enter закріплює перелік.</p>
              <div className="case-entry-row"><input id="case-points" ref={entryRef} value={entry} maxLength={600}
                onChange={event => { setEntry(event.target.value); setErrors([]); setNotice(''); }}
                autoComplete="off" spellCheck={false} placeholder="39б, 40в, 13в, 28б" aria-describedby="case-entry-hint case-entry-errors case-preview-note"
                aria-invalid={errors.length > 0} /><Button type="submit"><Plus className="size-4" />Додати</Button></div>
              <div id="case-entry-errors" role={errors.length ? 'alert' : undefined}>{errors.map((error, index) => <p key={index} className="case-input-error">{error}</p>)}</div>
              <p className="case-entry-feedback" id="case-preview-note" role="status">{notice || (previewCount ? `Попередній перегляд: ще ${previewCount} поз. із поля введення. Enter або «Додати» закріпить їх.` : entry.trim() && parsed.errors.length ? 'Завершіть або виправте код. Нове введення ще не враховано; нижче лише додані позиції та показники.' : 'Результати оновлюються під час введення.')}</p>
            </form>
            <fieldset className="case-measurements"><legend>Зріст і вага <span>· за потреби</span></legend>
              <label htmlFor="case-height">Зріст, см<input id="case-height" inputMode="decimal" autoComplete="off" maxLength={16} value={draft.height} placeholder="Не введено"
                aria-invalid={height.kind === 'invalid'} aria-describedby="case-height-error" onChange={event => onChange(current => ({ ...current, height: event.target.value }))} /></label>
              <label htmlFor="case-weight">Вага, кг<input id="case-weight" inputMode="decimal" autoComplete="off" maxLength={16} value={draft.weight} placeholder="Не введено"
                aria-invalid={weight.kind === 'invalid'} aria-describedby="case-weight-error" onChange={event => onChange(current => ({ ...current, weight: event.target.value }))} /></label>
              <p id="case-height-error" className="case-input-error">{height.kind === 'invalid' ? `Зріст: ${height.message}` : ''}</p>
              <p id="case-weight-error" className="case-input-error">{weight.kind === 'invalid' ? `Вага: ${weight.message}` : ''}</p>
            </fieldset>
          </div>
          <p className="case-privacy">Лише в пам’яті вкладки; оновлення сторінки очистить випадок. Не вводьте ПІБ чи інші ідентифікатори.</p>
          {draft.points.length ? <div className="case-selection-row">
            <ul className="case-selected" aria-label="Додані статті та пункти">
              {draft.points.map(point => {
                const rule = ARTICLE_RULES[point.article]?.find(rule => rule.point === point.point);
                const article = ARTICLES.find(article => article.article === point.article);
                return <li key={casePointKey(point)}>
                  <details><summary aria-label={`${casePointLabel(point)} · ${article?.title ?? 'Непідтверджена стаття'}`}><strong>{point.article}{point.point === '—' ? '' : point.point}</strong><ChevronDown aria-hidden="true" /></summary>
                    <div className="case-chip-detail"><strong>{article?.title ?? 'Непідтверджена стаття'}</strong>
                      {rule ? <><p className="vlk-normative">{rule.condition}</p><a href={officialRuleUrl(point.article, rule)} target="_blank" rel="noreferrer">Пункт у №402 <ExternalLink aria-hidden="true" /></a></> : null}
                    </div>
                  </details>
                  <button type="button" aria-label={`Видалити ${casePointLabel(point)}`} onClick={() => {
                    onChange(current => ({ ...current, points: current.points.filter(p => casePointKey(p) !== casePointKey(point)) }));
                    setNotice('Позицію вилучено.'); entryRef.current?.focus();
                  }}><X aria-hidden="true" /></button>
                </li>;
              })}
            </ul>
          </div> : null}
          {repeatedArticles.length ? <p className="case-input-error">Для статті {Array.from(new Set(repeatedArticles)).join(', ')} додано кілька пунктів. Звірте їх застосовність; вони не об’єднуються в тяжчий пункт.</p> : null}
          {(hasDriverCondition || hasFactorCondition) ? <div className="case-conditions" aria-label="Уточнення умов ТДВ">
            <p className="case-condition-title">Уточніть для точнішого результату</p>
            <div className="case-condition-fields">
              {hasDriverCondition ? <label htmlFor="case-role">Водії та екіпажі · ваша роль<select id="case-role" value={draft.vehicleRole} onChange={event => onChange(current => ({ ...current, vehicleRole: event.target.value as CaseDraft['vehicleRole'] }))}>
                <option value="unknown">Оберіть роль</option><option value="driver">Механік-водій / водій</option><option value="crew">Інший член екіпажу</option>
              </select></label> : null}
              {hasFactorCondition ? <label htmlFor="case-factor">Шкідливі чинники · робота з КРП<select id="case-factor" value={draft.harmfulFactor} onChange={event => onChange(current => ({ ...current, harmfulFactor: event.target.value as CaseDraft['harmfulFactor'] }))}>
                <option value="unknown">Уточніть чинник</option><option value="krp">Компоненти ракетного палива (КРП)</option><option value="other">Інший чинник цієї графи</option>
              </select></label> : null}
            </div>
          </div> : null}
          <div className="case-input-tools">
            <div className="case-clear">
              {clearPending ? <><p>Очистити всі позиції та показники випадку?</p><div><Button variant="outline" onClick={() => setClearPending(false)}>Скасувати</Button><Button onClick={clearCase}>Очистити випадок</Button></div></>
                : <Button variant="ghost" disabled={!hasData} onClick={() => setClearPending(true)}><RotateCcw className="size-4" />Новий випадок</Button>}
            </div>
          </div>
        </section>
        <section className="case-results" aria-labelledby="case-results-heading">
          {schedule.length ? <section className="case-schedule" aria-labelledby="case-schedule-heading">
            <div className="case-results-heading"><h2 id="case-schedule-heading">Розклад · кожен пункт окремо</h2></div>
            <p className="case-hint">Зелений — придатність за пунктом; жовтий — визначені види служби або тимчасовий стан; червоний — непридатність. Сірий — потрібна звірка.</p>
            {onReviewContextChange ? <details className="case-review-context" ref={reviewContextRef}><summary>Параметри огляду · {reviewContext.examineeType} · {reviewContext.scheduleGraph === 'all' ? 'графу не обрано' : `графа ${reviewContext.scheduleGraph}`}</summary><ReviewContextControls context={reviewContext} onChange={onReviewContextChange} prefix="case-review-" /></details> : null}
            {onReviewContextChange && schedule.some(item => item.result?.scheduleNeedsGraph) ? <Button variant="outline" className="case-context-action" onClick={() => {
              if (reviewContextRef.current) reviewContextRef.current.open = true;
              dialogRef.current?.querySelector<HTMLButtonElement>('#case-review-schedule-graph')?.focus();
            }}>Оберіть графу I, II або III для цих пунктів <ArrowRight aria-hidden="true" /></Button> : null}
            <ul className="case-schedule-items">{schedule.map(item => <li key={casePointKey(item.point)} data-schedule-tone={item.classification.tone}>
              <details><summary><strong>{item.point.article}{item.point.point === '—' ? '' : item.point.point}</strong><OutcomeBadge outcome={item.result?.outcome ?? ''} label={item.result?.label} /><ChevronDown aria-hidden="true" /></summary>
                <div className="case-schedule-literal"><p className="case-eyebrow">{item.result?.scope ?? 'Пункт не підтверджено'}</p><p className="vlk-normative">{item.result?.outcome ?? 'Звірте статтю та пункт у корпусі.'}</p>
                  {item.result?.outcome !== item.result?.scheduleText ? <><p className="case-eyebrow">Розклад хвороб · окремо від категорії огляду</p><p className="vlk-normative">{item.result?.scheduleText}</p></> : null}
                  {item.result?.note ? <p className="case-hint">{item.result.note}</p> : null}
                  {item.result ? <a href={item.result.sourceUrl} target="_blank" rel="noreferrer">{item.result.basis} <ExternalLink aria-hidden="true" /></a> : null}
                </div>
              </details>
            </li>)}</ul>
            <p className="case-schedule-note">«Визначені види служби» — коротка позначка; повне формулювання пункту відкривається натисканням. Категорію «обмежено придатний» не застосовуємо. Жодна позначка тут не є готовою постановою ВЛК.</p>
          </section> : null}
          <div className="case-results-heading"><div><p className="case-eyebrow">Огляд за введеними даними</p><h2 id="case-results-heading">Призначення за ТДВ</h2><p className="case-hint">Усі 12 граф ТДВ · назви замість номерів</p></div><a href={TDV_URL} target="_blank" rel="noreferrer">Додаток 3 <ExternalLink aria-hidden="true" /></a></div>
          <p className="case-scope-note"><AlertTriangle className="size-4" aria-hidden="true" /><span><strong>Не постанова ВЛК.</strong> Статус стосується лише введених критеріїв. Порожня клітинка чи відсутній рядок не дають дозволу; решту вимог перевіряйте окремо.</span></p>

          {!hasCriteria ? <div className="case-empty-result"><CircleHelp aria-hidden="true" /><p><strong>Спочатку додайте критерії</strong><span>Тут з’являться згруповані призначення: обмеження, уточнення та перевірені критерії. Натисніть назву, щоб побачити точні підстави.</span></p></div> : <>
          <div className="case-group-summary" role="status" aria-live="polite" aria-atomic="true">
            {CASE_RESULT_GROUPS.map(group => {
              const count = cards.filter(view => view.tone === group.tone).length;
              return count ? <span key={group.tone} data-case-tone={group.tone}><strong>{count}</strong>{group.label}</span> : null;
            })}
          </div>
          <div className="case-result-groups">
            {CASE_RESULT_GROUPS.map(group => {
              const grouped = columns.filter((_, index) => cards[index].tone === group.tone);
              if (!grouped.length) return null;
              const Icon = TONE_ICONS[group.tone];
              return <section className="case-result-group" key={group.tone} data-case-tone={group.tone} aria-labelledby={`case-group-${group.tone}`}>
                <div className="case-group-heading"><Icon aria-hidden="true" /><h3 id={`case-group-${group.tone}`}>{group.label}</h3><span>{grouped.length}</span></div>
                <p className="case-group-note">{group.note}</p>
                <ol className="case-columns">
                  {grouped.map(column => {
                    const index = column.column - 1, view = cards[index], destination = CASE_DESTINATIONS[index];
                    const expanded = expandedColumn === column.column;
                    return <li key={column.column} data-case-tone={view.tone}>
                      <article data-case-column={column.column} data-case-status={column.status} aria-label={`Графа ${column.column} · ${destination.title}`}>
                        <button type="button" className="case-card-open" aria-expanded={expanded} aria-controls={`case-evidence-${column.column}`} onClick={() => setExpandedColumn(expanded ? null : column.column)}>
                          <span className="case-row-number">{column.column}</span>
                          <span className="case-row-copy"><strong className="case-card-title">{destination.title}</strong><span className="case-row-reason">{caseRowReason(column, view)}{column.column === 6 ? ' · додаткові умови не перевірено' : ''}</span></span>
                          <span className="case-card-meta"><span>Чому <ChevronDown aria-hidden="true" /></span></span>
                        </button>
                        <div id={`case-evidence-${column.column}`} hidden={!expanded} className="case-column-detail">
                          <p className="case-detail-status">{view.heading}</p><p>{view.summary}</p>
                          {view.prompts.length ? <div className="case-card-prompts">{view.prompts.map(prompt => <button key={prompt.target} type="button" onClick={() => focusInput(prompt.target)}>{prompt.label}<ArrowRight aria-hidden="true" /></button>)}</div> : null}
                          {view.sourceNote ? <p className="case-source-gap">{view.sourceNote}</p> : null}
                          <p className="case-card-subtitle">{destination.subtitle}</p>
                          <p className="case-source-title"><strong>Повна назва графи · дослівно:</strong> {column.label}</p>
                          {column.column === 6 ? <p className="case-input-error">Додаткові умови водолазних посад не перевірено. Межа 190 см із таблиці не охоплює спеціальних вимог до водолазних посад. Звірте посаду, зріст, вік та інші умови. <a href="https://zakon.rada.gov.ua/laws/show/z1109-08#n536" target="_blank" rel="noreferrer">Глава 10 розділу II №402 <ExternalLink aria-hidden="true" /></a></p> : null}
                          <ul className="case-findings">{column.findings.map(finding => <li key={finding.key} data-finding-kind={finding.kind}>
                            <p><strong>{finding.label}</strong> <span>{FINDING_LABELS[finding.kind]}</span></p>
                            {finding.mark ? <p className="case-literal">У джерелі: <strong>«{finding.mark}»</strong>{finding.sourceScope === 'article' ? ' · рядок усієї статті' : ''}</p> : null}
                            <p>{finding.detail}</p>
                            {finding.sourceUrl ? <a href={finding.sourceUrl} target="_blank" rel="noreferrer">Джерело{finding.sourceRow ? (finding.sourceScope === 'general' ? ` · ${finding.label}` : ` · рядок ${finding.sourceRow}`) : ''} <ExternalLink aria-hidden="true" /></a> : null}
                          </li>)}</ul>
                          <p className="case-hint">Загальна придатність та інші вимоги тут не визначаються. Висновок приймає ВЛК.</p>
                        </div>
                      </article>
                    </li>;
                  })}
                </ol>
              </section>;
            })}
          </div>
          </>}
          <details className="case-method"><summary>Джерело та межі перевірки</summary><p>Це зведення окремих позначок і числових меж, а не формула загальної придатності. Порожня клітинка й відсутній рядок не означають дозвіл.</p>
            <p>Дані лише в пам’яті цієї вкладки; оновлення сторінки їх очистить. Не вводьте ПІБ чи інші ідентифікатори.</p>
            <p className="case-provenance">Корпус: редакція {EDITION}. Рядки статей і межі зросту/ваги звірено з Додатком 3 02.10.2026. <a href={TDV_DOCX_URL} target="_blank" rel="noreferrer">Офіційний файл таблиці <ExternalLink aria-hidden="true" /></a></p>
          </details>
        </section>
      </div>
    </VlkDialogContent>
  </Dialog>;
}
