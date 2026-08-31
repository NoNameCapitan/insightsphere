/**
 * Допоміжні функції для показу офіційних пояснень.
 *
 * Функції нічого не переписують: вони лише відбирають дослівні фрагменти,
 * що стосуються вибраного пункту, і позначають, які групи даних згадані.
 */

import type { ArticleExplanation } from "./explanations/types.ts";

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
  if (!explanation?.paragraphs.length) return [];
  if (point === "—") return explanation.paragraphs.slice(0, 8);

  const result: string[] = [];
  let active = false;
  for (const paragraph of explanation.paragraphs) {
    const mentions = pointMentions(paragraph);
    const startsSection = /^(?:\d+\)\s*)?(?:до|за)\s+пункт|^пункт/iu.test(paragraph);
    if (startsSection && mentions.length) active = mentions.includes(point);
    if (active || mentions.includes(point)) result.push(paragraph);
  }
  return [...new Set(result)].slice(0, 12);
}

/** Групи даних, які згадані в дослівному тексті пояснення. */
export function explanationSignals(explanation: ArticleExplanation | undefined) {
  const text = explanation?.paragraphs.join(" ") ?? "";
  return EXPLANATION_SIGNALS.filter((signal) => signal.pattern.test(text)).map(
    (signal) => signal.label,
  );
}
