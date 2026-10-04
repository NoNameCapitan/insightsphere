/** Presentation of existing evidence only. Never changes a medical rule or evaluated finding. */
import { casePointLabel, type CaseColumn, type CaseDraft } from './vlk-case.ts';

export const CASE_DESTINATIONS = [
  { title: 'Водії та екіпажі', subtitle: 'Танки, бронемашини, ракетні установки' },
  { title: 'Спеціальне призначення', subtitle: 'Підрозділи спеціального призначення' },
  { title: 'ДШВ, морська піхота, розвідка', subtitle: 'Особливий період · крім артилерійської розвідки' },
  { title: 'Штурмові підрозділи', subtitle: 'Сухопутні війська та Сили ТрО' },
  { title: 'Кораблі та підводні човни', subtitle: 'Військово-Морські Сили' },
  { title: 'Водолазні посади', subtitle: 'Водолази та спеціалісти забезпечення' },
  { title: 'Національний контингент і персонал', subtitle: 'Участь у міжнародних операціях' },
  { title: 'Робота зі шкідливими чинниками', subtitle: 'ДІВ, КРП, ЕМП, ЛВ та біологічні чинники' },
  { title: 'Навчання · без офіцерського звання', subtitle: 'Військові навчальні заклади й підрозділи ЗВО' },
  { title: 'Навчання · офіцери', subtitle: 'Військові навчальні заклади й підрозділи ЗВО' },
  { title: 'Спеціальні споруди', subtitle: 'Призначення на посади та служба' },
  { title: 'Сапери', subtitle: 'Посади всіх найменувань' },
] as const;

export type CasePrompt = { target: 'points' | 'height' | 'weight' | 'role' | 'factor'; label: string };
export type CaseCardView = {
  tone: 'restriction' | 'attention' | 'neutral' | 'checked';
  heading: string; summary: string; prompts: CasePrompt[]; sourceNote: string;
};

const briefCodes = (findings: CaseColumn['findings']) => {
  const codes = findings.map(f => f.key.startsWith('point:') ? f.key.slice(6).replace('-', '') : f.label);
  return codes.slice(0, 3).join(', ') + (codes.length > 3 ? ` та ще ${codes.length - 3} у підставах` : '');
};

export function caseCardView(column: CaseColumn, draft: CaseDraft): CaseCardView {
  const findings = column.findings;
  const restrictions = findings.filter(f => f.kind === 'restriction');
  const outside = findings.filter(f => f.kind === 'outside-bound');
  const conditional = findings.filter(f => f.kind === 'conditional');
  const missingRows = findings.filter(f => f.kind === 'no-row');
  const blankCells = findings.filter(f => f.kind === 'blank-cell');
  const prompts: CasePrompt[] = [];
  if (!draft.points.length) prompts.push({ target: 'points', label: 'Додайте статтю та пункт' });
  for (const metric of ['height', 'weight'] as const) {
    const relevant = findings.filter(f => f.key.startsWith(`${metric}-`));
    const invalid = relevant.some(f => f.kind === 'invalid-measurement');
    if (invalid || relevant.some(f => f.kind === 'missing-measurement')) {
      prompts.push({ target: metric, label: `${invalid ? 'Виправте' : 'Введіть'} ${metric === 'height' ? 'зріст, см' : 'вагу, кг'}` });
    }
  }
  if (conditional.some(f => f.mark === 'водії - НП')) prompts.push({ target: 'role', label: 'Уточніть: водій чи інший член екіпажу' });
  if (conditional.some(f => f.mark === 'КРП-НП')) prompts.push({ target: 'factor', label: 'Уточніть: є робота з КРП?' });
  const sourceNotes: string[] = [];
  if (missingRows.length) sourceNotes.push(`${briefCodes(missingRows)}: окремого рядка ТДВ немає. Звірте Розклад і пояснення.`);
  if (blankCells.length) sourceNotes.push(`${briefCodes(blankCells)}: клітинка порожня. Звірте висновок Розкладу.`);
  const sourceNote = sourceNotes.join(' ');
  const empty = !draft.points.length && !draft.height.trim() && !draft.weight.trim();
  if (empty) return { tone: 'neutral', heading: 'Очікує введення', summary: 'Додайте підтверджені статті й пункти, щоб перевірити це призначення.', prompts: [{ target: 'points', label: 'Додайте статтю та пункт' }], sourceNote: '' };
  if (restrictions.length || outside.length) return {
    tone: 'restriction', heading: restrictions.length ? 'Є позначка «НП»' : 'Поза числовою межею ТДВ',
    summary: [...(restrictions.length ? [`${briefCodes(restrictions)} · ${[...new Set(restrictions.map(f => `«${f.mark}»`))].join(', ')}`] : []), ...outside.map(f => f.detail)].join('; '), prompts, sourceNote,
  };
  if (conditional.length || prompts.some(p => p.target !== 'points')) return {
    tone: 'attention', heading: conditional.length ? 'Потрібне уточнення умови' : 'Перевірте показники',
    summary: conditional.length ? `${briefCodes(conditional)} · ${[...new Set(conditional.map(f => `«${f.mark}»`))].join(', ')}` : 'Для цієї графи ТДВ є числова межа. Додайте потрібний показник.', prompts, sourceNote,
  };
  // A missing row or blank cell never becomes a green card, even with supplied measurements.
  if (missingRows.length || blankCells.length) return {
    tone: 'neutral', heading: 'Звірте висновок Розкладу',
    summary: missingRows.length && !blankCells.length ? 'Відповідного рядка ТДВ немає. Це не підтверджує придатність; звірте Розклад і пояснення.' : 'У цій графі немає заповненої позначки для всіх введених пунктів.', prompts, sourceNote,
  };
  if (column.status === 'no-detected-restriction') return {
    tone: 'checked', heading: draft.points.length ? 'За введеними даними обмежень ТДВ не виявлено' : 'Введені показники у числових межах ТДВ',
    summary: draft.points.length ? 'Перевірено лише наведені позначки та числові межі. Інші вимоги до призначення перевіряються окремо.' : 'Перевірено лише наявні числові межі. Статті та пункти ще не додані.', prompts, sourceNote,
  };
  return { tone: 'neutral', heading: 'Перевірка не завершена', summary: draft.points.length ? `Перевірте підстави: ${draft.points.map(casePointLabel).join('; ')}.` : 'Для цих показників у графі немає числової межі. Додайте статті та пункти.', prompts, sourceNote };
}

/** Grouping is presentation only: it never merges, discards or upgrades evidence. */
export const CASE_RESULT_GROUPS = [
  { tone: 'restriction', label: 'Не проходить введені критерії', note: 'Є НП або вихід за числову межу для цих призначень.' },
  { tone: 'attention', label: 'Потрібне уточнення', note: 'Вкажіть показник або уточніть адресну умову.' },
  { tone: 'neutral', label: 'Дозвіл не встановлено', note: 'Немає достатньої заповненої підстави. Звірте Розклад і пояснення.' },
  { tone: 'checked', label: 'Перевірені критерії виконано', note: 'Лише перевірені позначки й числові межі; це не загальний допуск до служби.' },
] as const;

export function caseRowReason(column: CaseColumn, view: CaseCardView): string {
  const restrictions = column.findings.filter(f => f.kind === 'restriction');
  const outside = column.findings.filter(f => f.kind === 'outside-bound');
  if (restrictions.length || outside.length) return [
    restrictions.length ? `НП · ${briefCodes(restrictions)}` : '',
    ...outside.map(f => f.label.startsWith('Зріст') ? 'Зріст поза межею' : 'Вага поза межею'),
  ].filter(Boolean).join(' · ');
  if (view.tone === 'attention') return view.prompts.filter(p => p.target !== 'points').map(p => ({
    height: 'Потрібен зріст', weight: 'Потрібна вага', role: 'Водій чи член екіпажу?', factor: 'Робота з КРП?', points: '',
  })[p.target]).join(' · ') || 'Потрібна звірка умови';
  if (view.heading === 'Перевірено окремі критерії') return 'Лише окремі критерії ТДВ · звірте Розклад';
  if (view.tone === 'neutral') return view.heading === 'Очікує введення' ? 'Додайте статті / показники' :
    column.findings.some(f => f.kind === 'no-row') ? 'Немає рядка ТДВ' : column.findings.some(f => f.kind === 'blank-cell') ? 'Порожня клітинка ТДВ' : 'Перевірку не завершено';
  return column.findings.some(f => f.kind === 'not-applicable') ? 'Адресна умова не застосовується' : 'Введені числові межі виконано';
}
