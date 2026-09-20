/**
 * Контекст граф Розкладу хвороб.
 *
 * Графа не змінює дослівний результат пункту в локальному корпусі. Цей модуль
 * лише відбирає офіційні пояснення, де прямо названа обрана графа.
 */
export const SCHEDULE_GRAPHS = [
  { id: "all", label: "Усі графи" },
  { id: "I", label: "Графа I" },
  { id: "II", label: "Графа II" },
  { id: "III", label: "Графа III" },
] as const;

export type ScheduleGraph = (typeof SCHEDULE_GRAPHS)[number]["id"];

function normalizeRoman(value: string) {
  return value.toLocaleUpperCase("uk").replace(/І/g, "I").replace(/[–—−]/g, "-");
}

function graphsInMention(value: string): Set<Exclude<ScheduleGraph, "all">> {
  const found = new Set<Exclude<ScheduleGraph, "all">>();
  const normalized = normalizeRoman(value);
  if (/\bI\s*-\s*III\b/.test(normalized)) return new Set(["I", "II", "III"]);
  if (/\bII\s*-\s*III\b/.test(normalized)) return new Set(["II", "III"]);
  for (const token of normalized.match(/\b(?:III|II|I)\b/g) ?? []) {
    found.add(token as Exclude<ScheduleGraph, "all">);
  }
  return found;
}

export function paragraphAppliesToGraph(text: string, graph: ScheduleGraph) {
  if (graph === "all") return true;
  const normalized = normalizeRoman(text);
  const mentions = normalized.matchAll(/ГРАФ(?:А|ОЮ|АМИ|И)\s+([^.;:()]{0,32})/g);
  for (const mention of mentions) {
    if (graphsInMention(mention[1]).has(graph)) return true;
  }
  return false;
}

/** Дослівні абзаци пояснення, що прямо називають обрану графу. */
export function graphGuidance(paragraphs: readonly string[], graph: ScheduleGraph) {
  return graph === "all" ? [] : paragraphs.filter((text) => paragraphAppliesToGraph(text, graph));
}

export function graphContextLabel(graph: ScheduleGraph) {
  return graph === "all" ? "Графу не вибрано" : `Графа ${graph}`;
}
