/**
 * Локальний стан робочої сесії лікаря.
 *
 * Усе зберігається лише в браузері користувача. Під час читання запис із
 * попередніх версій структури не ламає застосунок: збережений пункт
 * відновлюється за номером статті та пунктом, а нормативний текст завжди
 * береться з поточної бази, а не зі старого запису.
 */

import { ARTICLE_RULES, type ArticleRule } from "./vlk-rules.ts";
import { ARTICLES, SPECIALTIES, type SpecialtyId, type VlkArticle } from "./vlk-sample-data.ts";

export const SESSION_KEY = "vlk-402-session-v2";
/** Ключі попередніх версій, які ще потрібно прочитати один раз. */
export const LEGACY_SESSION_KEYS = ["vlk-402-preview-session-v1"];

export const EXAMINEE_TYPES = [
  "Військовозобов’язаний",
  "Військовослужбовець",
  "Кандидат на контракт",
  "Кандидат до ВВНЗ",
] as const;

export type Mode = "express" | "detailed";
export type DoctorDirectory = Record<SpecialtyId, string>;

export type BasketItem = {
  id: string;
  articleId: string;
  article: string;
  title: string;
  icd: string;
  officialIncluded: string;
  point: string;
  condition: string;
  outcome: string;
  doctors: string;
};

export type SessionState = {
  basket: BasketItem[];
  examineeType: string;
  mode: Mode;
  directory: DoctorDirectory;
};

export type RestoredSession = SessionState & {
  /** Скільки збережених пунктів більше не існує в чинній редакції. */
  dropped: number;
};

export const EMPTY_DIRECTORY = Object.fromEntries(
  SPECIALTIES.map((item) => [item.id, ""]),
) as DoctorDirectory;

export const EMPTY_SESSION: SessionState = {
  basket: [],
  examineeType: EXAMINEE_TYPES[0],
  mode: "express",
  directory: EMPTY_DIRECTORY,
};

export function specialtyLabels(article: VlkArticle) {
  return article.specialties
    .map((id) => SPECIALTIES.find((item) => item.id === id)?.label)
    .filter(Boolean)
    .join(", ");
}

export function createBasketItem(article: VlkArticle, rule: ArticleRule): BasketItem {
  return {
    id: `${article.article}-${rule.point}`,
    articleId: article.id,
    article: article.article,
    title: article.title,
    icd: article.icd,
    officialIncluded: article.officialIncluded,
    point: rule.point,
    condition: rule.condition,
    outcome: rule.outcome,
    doctors: specialtyLabels(article),
  };
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

/** Відновлює пункт кошика з довільного старого запису або повертає undefined. */
function restoreBasketItem(raw: unknown): BasketItem | undefined {
  const record = asRecord(raw);
  if (!record) return undefined;

  const articleNumber =
    readString(record, "article") ||
    readString(record, "articleId").replace(/^article-/, "") ||
    readString(record, "id").split("-")[0];
  const article = ARTICLES.find((entry) => entry.article === articleNumber);
  if (!article) return undefined;

  const rules = ARTICLE_RULES[article.article] ?? [];
  if (!rules.length) return undefined;

  const point = readString(record, "point") || readString(record, "id").split("-").slice(1).join("-");
  const condition = readString(record, "condition");
  const rule =
    rules.find((entry) => entry.point === point) ??
    rules.find((entry) => entry.condition === condition) ??
    (rules.length === 1 ? rules[0] : undefined);
  if (!rule) return undefined;

  return createBasketItem(article, rule);
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
      return { ...EMPTY_SESSION, dropped: 0 };
    }
  }

  const record = asRecord(parsed);
  if (!record) return { ...EMPTY_SESSION, dropped: 0 };

  const storedBasket = Array.isArray(record.basket) ? record.basket : [];
  const basket: BasketItem[] = [];
  let dropped = 0;
  for (const entry of storedBasket) {
    const item = restoreBasketItem(entry);
    if (!item) {
      dropped += 1;
      continue;
    }
    if (basket.some((existing) => existing.id === item.id)) continue;
    basket.push(item);
  }

  const examineeType = readString(record, "examineeType");
  const mode = readString(record, "mode");

  return {
    basket,
    dropped,
    examineeType: (EXAMINEE_TYPES as readonly string[]).includes(examineeType)
      ? examineeType
      : EMPTY_SESSION.examineeType,
    mode: mode === "detailed" || mode === "express" ? mode : EMPTY_SESSION.mode,
    directory: restoreDirectory(record.directory),
  };
}

export function serializeSession(state: SessionState) {
  return JSON.stringify({
    version: 2,
    basket: state.basket.map((item) => ({ article: item.article, point: item.point })),
    examineeType: state.examineeType,
    mode: state.mode,
    directory: state.directory,
  });
}
