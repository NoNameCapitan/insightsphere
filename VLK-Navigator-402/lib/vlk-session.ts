/**
 * Локальний стан робочої сесії лікаря.
 *
 * Усе зберігається лише в браузері користувача. Під час читання запис із
 * попередніх версій структури не ламає застосунок: збережений пункт
 * відновлюється за номером статті та пунктом, а нормативний текст завжди
 * береться з поточної бази, а не зі старого запису.
 */

import { SPECIALTIES, type SpecialtyId, type VlkArticle } from "./vlk-sample-data.ts";
import { SCHEDULE_GRAPHS, type ScheduleGraph } from "./vlk-graphs.ts";

export const SESSION_KEY = "vlk-402-session-v3";
/** Ключі попередніх версій, які ще потрібно прочитати один раз. */
export const LEGACY_SESSION_KEYS = ["vlk-402-session-v2", "vlk-402-preview-session-v1"];

export const EXAMINEE_TYPES = [
  "Військовозобов’язаний",
  "Військовослужбовець",
  "Кандидат на контракт",
  "Кандидат до ВВНЗ",
] as const;

export type DoctorDirectory = Record<SpecialtyId, string>;

export type SessionState = {
  examineeType: string;
  scheduleGraph: ScheduleGraph;
  directory: DoctorDirectory;
};

export type RestoredSession = SessionState;

export const EMPTY_DIRECTORY = Object.fromEntries(
  SPECIALTIES.map((item) => [item.id, ""]),
) as DoctorDirectory;

export const EMPTY_SESSION: SessionState = {
  examineeType: EXAMINEE_TYPES[0],
  scheduleGraph: "all",
  directory: EMPTY_DIRECTORY,
};

export function specialtyLabels(article: VlkArticle) {
  return article.specialties
    .map((id) => SPECIALTIES.find((item) => item.id === id)?.label)
    .filter(Boolean)
    .join(", ");
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function readString(source: Record<string, unknown>, key: string) {
  const value = source[key];
  return typeof value === "string" ? value : "";
}

function restoreDirectory(raw: unknown): DoctorDirectory {
  const record = asRecord(raw);
  if (!record) return EMPTY_DIRECTORY;
  const directory = { ...EMPTY_DIRECTORY };
  for (const specialty of SPECIALTIES) {
    const value = record[specialty.id];
    if (typeof value === "string") directory[specialty.id] = value;
  }
  return directory;
}

/**
 * Читає збережену сесію. Приймає рядок із localStorage або вже розібраний
 * об'єкт; будь-який пошкоджений чи застарілий фрагмент просто ігнорується.
 */
export function restoreSession(raw: unknown): RestoredSession {
  let parsed: unknown = raw;
  if (typeof raw === "string") {
    try {
      parsed = JSON.parse(raw);
    } catch {
      return { ...EMPTY_SESSION };
    }
  }

  const record = asRecord(parsed);
  if (!record) return { ...EMPTY_SESSION };

  // Поля старіших версій (кошик, режим, чекліст) просто ігноруються.
  const examineeType = readString(record, "examineeType");
  const scheduleGraph = readString(record, "scheduleGraph");

  return {
    examineeType: (EXAMINEE_TYPES as readonly string[]).includes(examineeType)
      ? examineeType
      : EMPTY_SESSION.examineeType,
    scheduleGraph: SCHEDULE_GRAPHS.some((item) => item.id === scheduleGraph)
      ? scheduleGraph as ScheduleGraph
      : EMPTY_SESSION.scheduleGraph,
    directory: restoreDirectory(record.directory),
  };
}

export function serializeSession(state: SessionState) {
  return JSON.stringify({
    version: 4,
    examineeType: state.examineeType,
    scheduleGraph: state.scheduleGraph,
    directory: state.directory,
  });
}
