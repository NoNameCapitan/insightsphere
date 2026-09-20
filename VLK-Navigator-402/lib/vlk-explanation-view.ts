/**
 * Допоміжні функції для показу офіційних пояснень.
 *
 * Функції нічого не переписують: вони лише відбирають дослівні фрагменти,
 * що стосуються вибраного пункту, і позначають, які групи даних згадані.
 */

import type { ArticleExplanation } from "./explanations/types.ts";

const NEXT_CHAPTER_HEADING = /^[IVX]+\.\s/u;

/**
 * Відтинає службовий заголовок наступного розділу, який у вихідному корпусі
 * стоїть між останнім абзацом статті та якорем наступної статті.
 * Масив джерела не змінюється — це лише межа відображення поточної статті.
 */
export function articleExplanationParagraphs(
  explanation: ArticleExplanation | undefined,
): readonly string[] {
  if (!explanation?.paragraphs.length) return [];
  const boundary = explanation.paragraphs.findIndex(
    (paragraph, index) => index > 0 && NEXT_CHAPTER_HEADING.test(paragraph),
  );
  return boundary < 0 ? explanation.paragraphs : explanation.paragraphs.slice(0, boundary);
}

export const EXPLANATION_SIGNALS = [
  { label: "Порушення функцій", pattern: /порушенн\w* функц/iu },
  { label: "Стаціонарне обстеження", pattern: /стаціонар/iu },
  {
    label: "Інструментальні дані",
    pattern: /інструменталь|рентген|томограф|мрт|кт\b|екг|аудіометр/iu,
  },
  { label: "Лабораторні дані", pattern: /лаборатор/iu },
  { label: "Динаміка стану", pattern: /динаміч|повторн\w* обстеж|стійк\w* ремісі/iu },
  {
    label: "Профільний спеціаліст",
    pattern:
      /невропатолог|невролог|кардіолог|уролог|психіатр|офтальмолог|отоларинголог|хірург|дерматолог|ендокринолог|гематолог|мамолог/iu,
  },
] as const;

export function pointMentions(value: string) {
  if (!/пункт/iu.test(value)) return [];
  const prefix = value.slice(0, 220);
  const quoted = [...prefix.matchAll(/[«"“]([а-ґ])[»"”]/giu)].map((match) =>
    match[1].toLocaleLowerCase("uk"),
  );
  const plain = [...prefix.matchAll(/пункт(?:у|ом|ами|ів|и)?\s+([а-ґ])(?:\b|\))/giu)].map((match) =>
    match[1].toLocaleLowerCase("uk"),
  );
  return [...new Set([...quoted, ...plain])];
}

/** Фрагменти пояснення, що стосуються конкретного пункту статті. */
export function pointExplanation(explanation: ArticleExplanation | undefined, point: string) {
  const paragraphs = articleExplanationParagraphs(explanation);
  if (!paragraphs.length) return [];
  // Стаття без поділу на пункти має одне спільне пояснення — показуємо його
  // повністю, а не лише перші вісім фрагментів.
  if (point === "—") return [...paragraphs];

  const result: string[] = [];
  let active = false;
  for (const paragraph of paragraphs) {
    const mentions = pointMentions(paragraph);
    const startsSection = /^(?:\d+\)\s*)?(?:до|за)\s+пункт|^пункт/iu.test(paragraph);
    if (startsSection && mentions.length) active = mentions.includes(point);
    if (active || mentions.includes(point)) result.push(paragraph);
  }
  // Не обрізаємо й не дедуплікуємо дослівні фрагменти: повтор може бути
  // частиною нормативної структури, а лікар повинен бачити весь розділ пункту.
  return result;
}

/** Групи даних, які згадані в дослівному тексті пояснення. */
export function explanationSignals(explanation: ArticleExplanation | undefined) {
  const text = explanation?.paragraphs.join(" ") ?? "";
  return EXPLANATION_SIGNALS.filter((signal) => signal.pattern.test(text)).map(
    (signal) => signal.label,
  );
}
