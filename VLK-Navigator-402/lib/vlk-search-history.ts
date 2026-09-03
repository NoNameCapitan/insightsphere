/**
 * Останні пошукові запити лікаря.
 *
 * Зберігаються лише в цьому браузері, без персональних даних: це просто рядки,
 * які користувач сам ввів у пошук. Історія потрібна, щоб швидко повторити
 * попередній запит під час огляду.
 */

export const SEARCH_HISTORY_KEY = "vlk-402-search-history-v1";
export const SEARCH_HISTORY_LIMIT = 6;

/** Читає історію з довільного (можливо, пошкодженого) збереженого значення. */
export function readSearchHistory(raw: unknown): string[] {
  let parsed: unknown = raw;
  if (typeof raw === "string") {
    try {
      parsed = JSON.parse(raw);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(parsed)) return [];

  const history: string[] = [];
  for (const entry of parsed) {
    if (typeof entry !== "string") continue;
    const value = entry.trim();
    if (!value || value.length > 80) continue;
    if (history.some((item) => item.toLocaleLowerCase("uk") === value.toLocaleLowerCase("uk"))) continue;
    history.push(value);
    if (history.length >= SEARCH_HISTORY_LIMIT) break;
  }
  return history;
}

/** Додає запит на початок історії без дублікатів і з обмеженням довжини. */
export function addSearchHistory(history: readonly string[], query: string): string[] {
  const value = query.trim();
  if (value.length < 2 || value.length > 80) return [...history];
  const lower = value.toLocaleLowerCase("uk");
  return [value, ...history.filter((item) => item.toLocaleLowerCase("uk") !== lower)].slice(
    0,
    SEARCH_HISTORY_LIMIT,
  );
}
