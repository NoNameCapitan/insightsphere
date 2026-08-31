/**
 * Пошук по Розкладу хвороб.
 *
 * Модуль знаходить статтю лише за даними, які вже є в нормативній базі
 * (номер статті, офіційні коди МКХ-10, дослівний блок «Включено», пункти,
 * навігаційні синоніми та локальний довідник лікарів). Він не створює нових
 * відповідностей між діагнозом і статтею.
 */

import { DIAGNOSIS_ALIASES } from "./diagnosis-aliases.ts";
import { ARTICLE_RULES } from "./vlk-rules.ts";
import { ARTICLES, SPECIALTIES, type SpecialtyId, type VlkArticle } from "./vlk-sample-data.ts";

export type MatchReason = "icd" | "article" | "diagnosis" | "included" | "point" | "doctor" | "specialty";

export type SearchHit = {
  article: VlkArticle;
  score: number;
  reasons: MatchReason[];
  /** Дослівний фрагмент бази, у якому стався найвагоміший збіг. */
  evidence?: { reason: MatchReason; text: string };
};

export type DoctorDirectory = Partial<Record<SpecialtyId, string>>;

export const REASON_LABELS: Record<MatchReason, string> = {
  icd: "МКХ",
  article: "стаття",
  diagnosis: "діагноз",
  included: "Включено",
  point: "пункт",
  doctor: "лікар",
  specialty: "спеціальність",
};

const REASON_ORDER: MatchReason[] = ["icd", "article", "diagnosis", "included", "point", "doctor", "specialty"];

/** Кириличні літери, візуально тотожні латинським у кодах МКХ-10. */
const CODE_HOMOGLYPHS: Record<string, string> = {
  А: "A", В: "B", С: "C", Е: "E", Н: "H", І: "I", Ї: "I", Й: "I", Ј: "J",
  К: "K", М: "M", О: "O", Р: "P", Ѕ: "S", Т: "T", У: "Y", Х: "X", Ґ: "G", Г: "G",
};

const APOSTROPHES = /[’'`´ʼ‘]/g;
const DASHES = /[-‑–—−]/g;

/** Регістронезалежна форма без апострофів; дефіси стають пробілами. */
export function foldText(value: string) {
  return value
    .toLocaleLowerCase("uk")
    .replace(APOSTROPHES, "")
    .replace(DASHES, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Кодовий токен: кирилиця зводиться до латиниці, регістр — до верхнього. */
export function latinizeCode(value: string) {
  return value
    .toLocaleUpperCase("uk")
    .replace(/[А-ЯЇІЄҐЈЅ]/gu, (letter) => CODE_HOMOGLYPHS[letter] ?? letter);
}

type IcdCode = { letter: string; value: number; precise: boolean };
type IcdRange = { letter: string; from: number; to: number };

const CODE_PATTERN = /^([A-Z])(\d{1,2})(?:[.,](\d{1,2}))?$/;

function parseCode(token: string): IcdCode | null {
  const match = CODE_PATTERN.exec(latinizeCode(token));
  if (!match) return null;
  const [, letter, whole, fraction] = match;
  const value = Number(fraction ? `${whole}.${fraction}` : whole);
  return { letter, value, precise: Boolean(fraction) };
}

/** Верхня межа коду: «A09» покриває A09.9, «U07.2» — U07.29. */
function upperBound(code: IcdCode) {
  return code.value + (code.precise ? 0.0999 : 0.9999);
}

/** Розбирає офіційне поле МКХ статті у діапазони: «A00-A09; Z22; S60-69». */
function parseIcdRanges(icd: string): IcdRange[] {
  const ranges: IcdRange[] = [];
  for (const rawPart of icd.split(/[;,]/)) {
    const part = rawPart.trim();
    if (!part || part === "—") continue;
    const [rawStart, rawEnd] = part.split(DASHES).map((piece) => piece.trim());
    const start = parseCode(rawStart);
    if (!start) continue;
    if (!rawEnd) {
      ranges.push({ letter: start.letter, from: start.value, to: upperBound(start) });
      continue;
    }
    // «S60-69»: кінець діапазону успадковує літеру початку.
    const end = parseCode(/^\d/.test(rawEnd) ? `${start.letter}${rawEnd}` : rawEnd);
    if (!end || end.letter !== start.letter) {
      ranges.push({ letter: start.letter, from: start.value, to: upperBound(start) });
      continue;
    }
    ranges.push({ letter: start.letter, from: start.value, to: upperBound(end) });
  }
  return ranges;
}

type QueryCode = { letter: string; from: number; to: number };

/** Кодовий запит: окремий код «I10» або діапазон «I10-I15». */
function parseQueryCode(term: string): QueryCode | null {
  const [rawStart, rawEnd] = term.split(DASHES).map((piece) => piece.trim());
  const start = parseCode(rawStart);
  if (!start) return null;
  if (!rawEnd) return { letter: start.letter, from: start.value, to: upperBound(start) };
  const end = parseCode(/^\d/.test(rawEnd) ? `${start.letter}${rawEnd}` : rawEnd);
  if (!end || end.letter !== start.letter) return { letter: start.letter, from: start.value, to: upperBound(start) };
  return { letter: start.letter, from: start.value, to: upperBound(end) };
}

function overlaps(range: IcdRange, query: QueryCode) {
  return range.letter === query.letter && query.from <= range.to && query.to >= range.from;
}

type ArticleIndex = {
  article: VlkArticle;
  ranges: IcdRange[];
  title: string;
  summary: string;
  included: string;
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
    article.specialties
      .map((id) => SPECIALTIES.find((item) => item.id === id)?.label ?? "")
      .join(" "),
  );
  const conditions = foldText(rules.map((rule) => `${rule.condition} ${rule.outcome}`).join(" "));
  const tokens = new Set(
    `${title} ${summary} ${included} ${aliases.join(" ")} ${conditions} ${specialtyLabels}`
      .split(" ")
      .filter((token) => token.length > 2),
  );

  const index: ArticleIndex = {
    article,
    ranges: parseIcdRanges(article.icd),
    title,
    summary,
    included,
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

const DIRECTIVE_ARTICLE = /^(?:стаття|статті|статтю|статей|ст)$/u;
const DIRECTIVE_POINT = /^(?:пункт|пункту|пункти|пунктом|п)$/u;

type TermScore = { score: number; reason: MatchReason; evidence?: string } | null;

function scoreTerm(index: ArticleIndex, term: string, directory: DoctorDirectory, pointTerm: boolean): TermScore {
  const code = parseQueryCode(term);
  if (code && index.ranges.some((range) => overlaps(range, code))) {
    return { score: 1000, reason: "icd" };
  }

  if (/^\d{1,2}$/.test(term)) {
    if (index.article.article === term) return { score: 950, reason: "article" };
  }

  const doctorNames = index.article.specialties
    .map((id) => foldText(directory[id] ?? ""))
    .filter(Boolean)
    .join(" ");
  if (term.length >= 3 && doctorNames && doctorNames.split(/[\s,;]+/).some((name) => name.startsWith(term))) {
    return { score: 800, reason: "doctor" };
  }

  if (pointTerm && index.points.includes(term)) return { score: 620, reason: "point" };

  const exactAlias = index.aliases.find((alias) => alias === term);
  if (exactAlias) return { score: 900, reason: "diagnosis", evidence: index.article.officialIncluded };
  if (index.title === term) return { score: 880, reason: "diagnosis" };
  if (index.aliases.some((alias) => alias.split(" ").some((word) => word.startsWith(term)))) {
    return { score: 760, reason: "diagnosis", evidence: index.article.officialIncluded };
  }
  if (index.title.split(" ").some((word) => word.startsWith(term))) return { score: 700, reason: "diagnosis" };
  if (index.title.includes(term)) return { score: 660, reason: "diagnosis" };
  if (index.summary.includes(term)) return { score: 560, reason: "diagnosis", evidence: index.article.summary };
  if (index.included.includes(term)) {
    return { score: 500, reason: "included", evidence: index.article.officialIncluded };
  }
  if (latinizeCode(index.included).includes(latinizeCode(term)) && /\d/.test(term)) {
    return { score: 480, reason: "included", evidence: index.article.officialIncluded };
  }
  if (index.conditions.includes(term)) {
    const rules = ARTICLE_RULES[index.article.article] ?? [];
    const rule = rules.find((entry) => foldText(entry.condition).includes(term));
    return { score: 420, reason: "point", evidence: rule?.condition };
  }
  if (index.specialtyLabels.includes(term)) return { score: 320, reason: "specialty" };
  if (fuzzyToken(index.tokens, term)) return { score: 200, reason: "diagnosis" };

  return null;
}

export function searchArticles(
  query: string,
  directory: DoctorDirectory = {},
  articles: readonly VlkArticle[] = ARTICLES,
): SearchHit[] {
  const folded = foldText(query);
  if (!folded) return [];

  const rawTerms = folded.split(" ").filter(Boolean);
  const terms: string[] = [];
  let pointTerm = false;
  for (const term of rawTerms) {
    if (DIRECTIVE_ARTICLE.test(term)) continue;
    if (DIRECTIVE_POINT.test(term)) {
      pointTerm = true;
      continue;
    }
    terms.push(term);
  }
  if (!terms.length) return [];

  const hits: SearchHit[] = [];
  for (const article of articles) {
    const index = buildIndex(article);
    let score = 0;
    const reasons = new Set<MatchReason>();
    let matchedAll = true;
    let evidence: SearchHit["evidence"];
    let evidenceScore = -1;

    for (const term of terms) {
      const result = scoreTerm(index, term, directory, pointTerm);
      if (!result) {
        matchedAll = false;
        break;
      }
      score += result.score;
      reasons.add(result.reason);
      if (result.evidence && result.score > evidenceScore) {
        evidence = { reason: result.reason, text: result.evidence };
        evidenceScore = result.score;
      }
    }

    if (!matchedAll) continue;
    hits.push({
      article,
      score,
      reasons: REASON_ORDER.filter((reason) => reasons.has(reason)),
      evidence,
    });
  }

  return hits.sort(
    (a, b) => b.score - a.score || Number(a.article.article) - Number(b.article.article),
  );
}

export type HighlightPart = { text: string; match: boolean };

/**
 * Розбиває текст на частини для підсвічування збігу. Апостроф у тексті
 * ігнорується, щоб «мязів» підсвітило «м’язів».
 */
export function highlightParts(text: string, query: string): HighlightPart[] {
  const terms = foldText(query)
    .split(" ")
    .filter((term) => term.length >= 2)
    .sort((a, b) => b.length - a.length);
  if (!terms.length) return [{ text, match: false }];

  const patterns = terms.map((term) => {
    const escaped = [...term].map((character) => character.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    return escaped.join("[’'`´ʼ‘]?");
  });
  const regex = new RegExp(`(${patterns.join("|")})`, "giu");

  const parts: HighlightPart[] = [];
  let lastIndex = 0;
  for (const match of text.matchAll(regex)) {
    const start = match.index ?? 0;
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
