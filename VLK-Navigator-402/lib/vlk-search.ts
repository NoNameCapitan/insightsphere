/**
 * Пошук по Розкладу хвороб.
 *
 * Модуль знаходить статтю лише за даними, які вже є в нормативній базі
 * (номер статті, офіційні коди МКХ-10, дослівний блок «Включено», пункти,
 * навігаційні синоніми та локальний довідник лікарів). Він не створює нових
 * відповідностей між діагнозом і статтею й не змінює нормативний текст.
 *
 * Логіка розкладена на чисті функції: normalizeSearchQuery, parseArticleNumber,
 * normalizeIcdCode, getSearchMatchType, scoreSearchResult і searchArticles.
 */

import { DIAGNOSIS_ALIASES } from "./diagnosis-aliases.ts";
import { ARTICLE_RULES } from "./vlk-rules.ts";
import { ARTICLES, SPECIALTIES, type SpecialtyId, type VlkArticle } from "./vlk-sample-data.ts";

export type MatchType =
  | "article"
  | "icd"
  | "title"
  | "synonym"
  | "summary"
  | "official"
  | "doctor"
  | "point"
  | "specialty"
  | "fuzzy";

/** Ваги збігів. Порядок відповідає таблиці пріоритетів технічного завдання. */
export const SEARCH_WEIGHTS: Record<MatchType | "titlePrefix" | "titleWord", number> = {
  article: 100,
  icd: 95,
  title: 90,
  titlePrefix: 80,
  titleWord: 70,
  synonym: 60,
  doctor: 55,
  point: 50,
  summary: 45,
  specialty: 35,
  official: 30,
  fuzzy: 20,
};

/** Розгорнуте пояснення, чому знайдено результат. */
export const MATCH_TYPE_LABELS: Record<MatchType, string> = {
  article: "Збіг за номером статті",
  icd: "Збіг за кодом МКХ-10",
  title: "Збіг у назві діагнозу",
  synonym: "Збіг у синонімі",
  summary: "Збіг у короткому описі",
  official: "Збіг у нормативному тексті",
  doctor: "Збіг за прізвищем лікаря",
  point: "Збіг за пунктом статті",
  specialty: "Збіг за спеціальністю",
  fuzzy: "Виправлено ймовірну помилку",
};

/** Коротка позначка для компактного підпису під результатом. */
export const MATCH_TYPE_SHORT: Record<MatchType, string> = {
  article: "стаття",
  icd: "МКХ-10",
  title: "назва",
  synonym: "синонім",
  summary: "опис",
  official: "нормативний текст",
  doctor: "лікар",
  point: "пункт",
  specialty: "спеціальність",
  fuzzy: "виправлення",
};

const MATCH_ORDER: MatchType[] = [
  "article",
  "icd",
  "title",
  "synonym",
  "doctor",
  "point",
  "summary",
  "specialty",
  "official",
  "fuzzy",
];

export type SearchHit = {
  article: VlkArticle;
  score: number;
  matches: MatchType[];
  /** Дослівний фрагмент бази, у якому стався найвагоміший збіг. */
  evidence?: { match: MatchType; text: string };
};

export type DoctorDirectory = Partial<Record<SpecialtyId, string>>;

/** Приклади запитів для першого знайомства з пошуком. */
export const POPULAR_QUERIES = ["астма", "J45", "стаття 47", "гіпертонія", "меніск", "I10"];

/** Кириличні літери, візуально тотожні латинським у кодах МКХ-10. */
const CODE_HOMOGLYPHS: Record<string, string> = {
  А: "A", В: "B", С: "C", Е: "E", Н: "H", І: "I", Ї: "I", Й: "I", Ј: "J",
  К: "K", М: "M", О: "O", Р: "P", Ѕ: "S", Т: "T", У: "Y", Х: "X", Ґ: "G", Г: "G",
};

const APOSTROPHES = /[’'`´ʼ‘]/g;
const DASHES = /[-‑–—−]/g;
const ARTICLE_WORDS = /^(?:стаття|статті|статтю|статей|ст)$/u;
const POINT_WORDS = /^(?:пункт|пункту|пункти|пунктом|пунктів|п)$/u;

/**
 * Нормалізує запит: нижній регістр, єдиний дефіс, без апострофів,
 * без повторних пробілів. Українські літери не транслітеруються.
 */
export function normalizeSearchQuery(value: string) {
  return value
    .toLocaleLowerCase("uk")
    .replace(APOSTROPHES, "")
    .replace(DASHES, "-")
    .replace(/\s+/g, " ")
    .trim();
}

/** Регістронезалежна форма для порівняння текстів: дефіси стають пробілами. */
export function foldText(value: string) {
  return normalizeSearchQuery(value).replace(/-/g, " ").replace(/\s+/g, " ").trim();
}

/** Кодовий токен: кирилиця зводиться до латиниці, регістр — до верхнього. */
export function latinizeCode(value: string) {
  return value
    .toLocaleUpperCase("uk")
    .replace(/[А-ЯЇІЄҐЈЅ]/gu, (letter) => CODE_HOMOGLYPHS[letter] ?? letter);
}

/**
 * Номер статті із запиту: «47», «стаття 47», «ст. 47», «ст.47».
 * Повертає рядок з номером або null.
 */
export function parseArticleNumber(value: string): string | null {
  const normalized = normalizeSearchQuery(value)
    .replace(/\./g, " ")
    .replace(/([а-яіїєґ])(\d)/gu, "$1 $2")
    .replace(/\s+/g, " ")
    .trim();
  const match = /^(?:(?:стаття|статті|статтю|статей|ст)\s+)?(\d{1,2})$/u.exec(normalized);
  return match ? String(Number(match[1])) : null;
}

/**
 * Канонічний код МКХ-10: «j45» → «J45», «j45.0» → «J45.0», «j450» → «J45.0».
 * Кирилиця в кодах зводиться до латиниці.
 */
export function normalizeIcdCode(value: string): string | null {
  const token = latinizeCode(normalizeSearchQuery(value)).replace(/\s+/g, "");
  const match = /^([A-Z])(\d{2})(?:[.,]?(\d{1,2}))?$/.exec(token);
  if (!match) return null;
  const [, letter, whole, fraction] = match;
  return fraction ? `${letter}${whole}.${fraction}` : `${letter}${whole}`;
}

type IcdRange = { letter: string; from: number; to: number };

function codeValue(code: string) {
  const [, digits] = /^[A-Z](\d{2}(?:\.\d{1,2})?)$/.exec(code) ?? [];
  return digits ? Number(digits) : Number.NaN;
}

function upperBound(code: string) {
  return codeValue(code) + (code.includes(".") ? 0.0999 : 0.9999);
}

/** Діапазон кодів: «J45-J46», «J45–J46», «S60-69» або окремий код. */
export function parseIcdRange(value: string): IcdRange | null {
  const parts = normalizeSearchQuery(value).split("-").map((part) => part.trim()).filter(Boolean);
  if (!parts.length || parts.length > 2) return null;

  const start = normalizeIcdCode(parts[0]);
  if (!start) return null;
  const letter = start[0];
  if (parts.length === 1) {
    return { letter, from: codeValue(start), to: upperBound(start) };
  }

  const endRaw = /^\d/.test(parts[1]) ? `${letter}${parts[1]}` : parts[1];
  const end = normalizeIcdCode(endRaw);
  if (!end || end[0] !== letter) {
    return { letter, from: codeValue(start), to: upperBound(start) };
  }
  return { letter, from: codeValue(start), to: upperBound(end) };
}

/** Розбирає офіційне поле МКХ статті у діапазони: «A00-A09; Z22; S60-69». */
function parseArticleRanges(icd: string): IcdRange[] {
  const ranges: IcdRange[] = [];
  for (const part of icd.split(/[;,]/)) {
    const range = parseIcdRange(part);
    if (range) ranges.push(range);
  }
  return ranges;
}

function overlaps(range: IcdRange, query: IcdRange) {
  return range.letter === query.letter && query.from <= range.to && query.to >= range.from;
}

type ArticleIndex = {
  article: VlkArticle;
  ranges: IcdRange[];
  title: string;
  titleWords: string[];
  summary: string;
  included: string;
  includedLatin: string;
  aliases: string[];
  points: string[];
  conditions: string;
  specialtyLabels: string;
  tokens: Set<string>;
};

const INDEX_CACHE = new Map<string, ArticleIndex>();

function buildIndex(article: VlkArticle): ArticleIndex {
  const cached = INDEX_CACHE.get(article.id);
  if (cached) return cached;

  const rules = ARTICLE_RULES[article.article] ?? [];
  const aliases = (DIAGNOSIS_ALIASES[article.article] ?? []).map(foldText);
  const title = foldText(article.title);
  const summary = foldText(article.summary);
  const included = foldText(article.officialIncluded);
  const specialtyLabels = foldText(
    article.specialties.map((id) => SPECIALTIES.find((item) => item.id === id)?.label ?? "").join(" "),
  );
  const conditions = foldText(rules.map((rule) => `${rule.condition} ${rule.outcome}`).join(" "));
  const tokens = new Set(
    `${title} ${summary} ${included} ${aliases.join(" ")} ${conditions} ${specialtyLabels}`
      .split(" ")
      .filter((token) => token.length > 2),
  );

  const index: ArticleIndex = {
    article,
    ranges: parseArticleRanges(article.icd),
    title,
    titleWords: title.split(" ").filter(Boolean),
    summary,
    included,
    includedLatin: latinizeCode(included),
    aliases,
    points: rules.map((rule) => foldText(rule.point)),
    conditions,
    specialtyLabels,
    tokens,
  };
  INDEX_CACHE.set(article.id, index);
  return index;
}

function withinOneEdit(a: string, b: string) {
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > 1) return false;
  const [shorter, longer] = a.length <= b.length ? [a, b] : [b, a];
  let i = 0;
  let j = 0;
  let edits = 0;
  while (i < shorter.length && j < longer.length) {
    if (shorter[i] === longer[j]) {
      i += 1;
      j += 1;
      continue;
    }
    edits += 1;
    if (edits > 1) return false;
    if (shorter.length === longer.length) i += 1;
    j += 1;
  }
  return edits + (longer.length - j) + (shorter.length - i) <= 1;
}

/** Часткове співпадіння з допуском однієї помилки для довгих слів. */
function fuzzyToken(tokens: Set<string>, term: string) {
  if (term.length < 5) return false;
  for (const token of tokens) {
    if (token.length < 4) continue;
    if (withinOneEdit(token, term)) return true;
    if (token.length > term.length && withinOneEdit(token.slice(0, term.length), term)) return true;
  }
  return false;
}

export type QueryTerm =
  | { kind: "article"; value: string }
  | { kind: "icd"; value: string; range: IcdRange }
  | { kind: "point"; value: string }
  | { kind: "text"; value: string };

/**
 * Розбирає запит на терміни: номер статті, код або діапазон МКХ, пункт, слово.
 * Службові слова «стаття», «ст.», «пункт» прибираються, якщо після них лишається
 * номер або літера пункту.
 */
export function parseSearchQuery(query: string): QueryTerm[] {
  const normalized = normalizeSearchQuery(query);
  if (!normalized) return [];

  const raw = normalized.split(" ").filter(Boolean);
  const terms: QueryTerm[] = [];
  let expectArticle = false;
  let expectPoint = false;

  for (const token of raw) {
    const bare = token.replace(/\.$/, "");

    if (ARTICLE_WORDS.test(bare)) {
      expectArticle = true;
      continue;
    }
    if (POINT_WORDS.test(bare)) {
      expectPoint = true;
      continue;
    }

    if (expectArticle && /^\d{1,2}$/.test(bare)) {
      terms.push({ kind: "article", value: String(Number(bare)) });
      expectArticle = false;
      continue;
    }
    if (expectPoint && /^[а-ґ]$/u.test(bare)) {
      terms.push({ kind: "point", value: bare });
      expectPoint = false;
      continue;
    }
    expectArticle = false;
    expectPoint = false;

    const attached = parseArticleNumber(token);
    if (attached && /[а-яіїєґ]/u.test(bare)) {
      terms.push({ kind: "article", value: attached });
      continue;
    }

    const range = parseIcdRange(token);
    if (range) {
      terms.push({ kind: "icd", value: token, range });
      continue;
    }
    if (/^\d{1,2}$/.test(bare)) {
      terms.push({ kind: "article", value: String(Number(bare)) });
      continue;
    }
    for (const part of token.split("-").filter(Boolean)) {
      terms.push({ kind: "text", value: part });
    }
  }

  return terms;
}

type TermMatch = { score: number; match: MatchType; evidence?: string } | null;

/** Тип збігу терміна з конкретною статтею або null, якщо збігу немає. */
export function getSearchMatchType(
  index: ArticleIndex,
  term: QueryTerm,
  directory: DoctorDirectory,
): TermMatch {
  if (term.kind === "article") {
    return index.article.article === term.value
      ? { score: SEARCH_WEIGHTS.article, match: "article" }
      : null;
  }

  if (term.kind === "icd") {
    return index.ranges.some((range) => overlaps(range, term.range))
      ? { score: SEARCH_WEIGHTS.icd, match: "icd", evidence: index.article.officialIncluded }
      : null;
  }

  if (term.kind === "point") {
    return index.points.includes(term.value)
      ? { score: SEARCH_WEIGHTS.point, match: "point" }
      : null;
  }

  const value = term.value;

  const doctors = index.article.specialties
    .map((id) => foldText(directory[id] ?? ""))
    .filter(Boolean)
    .join(" ");
  if (value.length >= 3 && doctors && doctors.split(/[\s,;]+/).some((name) => name.startsWith(value))) {
    return { score: SEARCH_WEIGHTS.doctor, match: "doctor" };
  }

  if (index.title === value) return { score: SEARCH_WEIGHTS.title, match: "title" };
  if (index.title.startsWith(value)) return { score: SEARCH_WEIGHTS.titlePrefix, match: "title" };
  if (index.titleWords.some((word) => word.startsWith(value))) {
    return { score: SEARCH_WEIGHTS.titleWord, match: "title" };
  }
  if (index.aliases.includes(value)) {
    return { score: SEARCH_WEIGHTS.synonym, match: "synonym", evidence: index.article.officialIncluded };
  }
  if (index.aliases.some((alias) => alias.split(" ").some((word) => word.startsWith(value)))) {
    return { score: SEARCH_WEIGHTS.synonym, match: "synonym", evidence: index.article.officialIncluded };
  }
  if (index.title.includes(value)) return { score: SEARCH_WEIGHTS.titleWord, match: "title" };
  if (index.summary.includes(value)) {
    return { score: SEARCH_WEIGHTS.summary, match: "summary", evidence: index.article.summary };
  }
  if (index.included.includes(value) || (/\d/.test(value) && index.includedLatin.includes(latinizeCode(value)))) {
    return { score: SEARCH_WEIGHTS.official, match: "official", evidence: index.article.officialIncluded };
  }
  if (index.specialtyLabels.includes(value)) {
    return { score: SEARCH_WEIGHTS.specialty, match: "specialty" };
  }
  if (index.conditions.includes(value)) {
    const rules = ARTICLE_RULES[index.article.article] ?? [];
    const rule = rules.find((entry) => foldText(entry.condition).includes(value));
    return { score: SEARCH_WEIGHTS.official, match: "official", evidence: rule?.condition };
  }
  if (fuzzyToken(index.tokens, value)) return { score: SEARCH_WEIGHTS.fuzzy, match: "fuzzy" };

  return null;
}

/** Сумарна релевантність статті за всіма термінами запиту. */
export function scoreSearchResult(
  article: VlkArticle,
  terms: readonly QueryTerm[],
  directory: DoctorDirectory = {},
): SearchHit | null {
  if (!terms.length) return null;
  const index = buildIndex(article);

  let score = 0;
  const matches = new Set<MatchType>();
  let evidence: SearchHit["evidence"];
  let evidenceScore = -1;

  for (const term of terms) {
    const result = getSearchMatchType(index, term, directory);
    if (!result) return null;
    score += result.score;
    matches.add(result.match);
    if (result.evidence && result.score > evidenceScore) {
      evidence = { match: result.match, text: result.evidence };
      evidenceScore = result.score;
    }
  }

  return {
    article,
    score,
    matches: MATCH_ORDER.filter((match) => matches.has(match)),
    evidence,
  };
}

export function searchArticles(
  query: string,
  directory: DoctorDirectory = {},
  articles: readonly VlkArticle[] = ARTICLES,
): SearchHit[] {
  const terms = parseSearchQuery(query);
  if (!terms.length) return [];

  const hits: SearchHit[] = [];
  for (const article of articles) {
    const hit = scoreSearchResult(article, terms, directory);
    if (hit) hits.push(hit);
  }

  return hits.sort(
    (a, b) => b.score - a.score || Number(a.article.article) - Number(b.article.article),
  );
}

export type HighlightPart = { text: string; match: boolean };

const WORD_PATTERN = /[\p{L}\p{N}][\p{L}\p{N}’'`´ʼ.\-]*/gu;

/** Регістронезалежне слово без апострофів і кінцевої пунктуації. */
function foldWord(value: string) {
  return value
    .toLocaleLowerCase("uk")
    .replace(APOSTROPHES, "")
    .replace(/^[.\-]+|[.\-]+$/g, "");
}

/**
 * Основа слова для підсвічування словоформ: «гіпертонія» підсвічує
 * «гіпертонічна», але «меніск» не чіпає «менінгіт».
 */
function highlightStem(term: string) {
  return term.length > 5 ? term.slice(0, Math.max(5, term.length - 2)) : term;
}

/**
 * Розбиває текст на частини для підсвічування збігу. Підсвічується ціле слово:
 * словоформа того самого кореня, а для кодів МКХ — кирилиця нарівні з
 * латиницею («I10» підсвічує «І10-І15»).
 */
export function highlightParts(text: string, query: string): HighlightPart[] {
  const terms = foldText(query)
    .split(" ")
    .filter((term) => term.length >= 2);
  if (!terms.length) return [{ text, match: false }];

  const stems = terms.map((term) => ({
    term,
    stem: highlightStem(term),
    code: normalizeIcdCode(term) ?? "",
  }));

  const matchesTerm = (word: string) => {
    const folded = foldWord(word);
    if (!folded) return false;
    const latin = latinizeCode(folded);
    const canonical = normalizeIcdCode(folded) ?? "";
    return stems.some(({ term, stem, code }) => {
      if (folded === term) return true;
      if (term.length >= 4 && folded.startsWith(stem)) return true;
      if (code && (latin.startsWith(code) || canonical.startsWith(code))) return true;
      return false;
    });
  };

  const parts: HighlightPart[] = [];
  let lastIndex = 0;
  for (const match of text.matchAll(WORD_PATTERN)) {
    const start = match.index ?? 0;
    if (!matchesTerm(match[0])) continue;
    if (start > lastIndex) parts.push({ text: text.slice(lastIndex, start), match: false });
    parts.push({ text: match[0], match: true });
    lastIndex = start + match[0].length;
  }
  if (lastIndex < text.length) parts.push({ text: text.slice(lastIndex), match: false });
  return parts.length ? parts : [{ text, match: false }];
}

/**
 * Вікно тексту навколо збігу — щоб показати, у якому саме дослівному фрагменті
 * знайдено запит, не показуючи весь абзац.
 */
export function snippetAround(text: string, query: string, size = 110) {
  if (text.length <= size) return text;
  const folded = foldText(text);
  const term = foldText(query).split(" ").filter(Boolean).sort((a, b) => b.length - a.length)[0];
  const position = term ? folded.indexOf(term) : -1;
  if (position < 0) return `${text.slice(0, size).trimEnd()}…`;

  const start = Math.max(0, position - Math.floor(size / 3));
  const end = Math.min(text.length, start + size);
  return `${start > 0 ? "…" : ""}${text.slice(start, end).trim()}${end < text.length ? "…" : ""}`;
}
