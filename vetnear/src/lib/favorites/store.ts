"use client";

import { writeJSON } from "@/lib/storage";

export const FAVORITE_PLACES_KEY = "vetnear:favorite-places";
const CHANGE_EVENT = "vetnear:favorite-places-changed";

export type FavoritePlacesIssue = "unavailable" | "corrupt" | null;
export type FavoritePlacesState = { ids: string[]; issue: FavoritePlacesIssue };

export function favoritePlacesMessage(issue: FavoritePlacesIssue): string {
  return issue === "corrupt"
    ? "Не вдалося прочитати збережені місця. Дані списку пошкоджені; інші картки й записи не змінено."
    : "Не вдалося зберегти місце. Пам’ять браузера заповнена або зберігання вимкнене. Спробуйте ще раз.";
}

function validId(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 200 && value.trim() === value && !/[\u0000-\u001f]/.test(value);
}

/** Local data is untrusted. A corrupt list is kept intact until an explicit reset. */
export function readFavoritePlaces(): FavoritePlacesState {
  if (typeof window === "undefined") return { ids: [], issue: null };
  let raw: string | null;
  try { raw = localStorage.getItem(FAVORITE_PLACES_KEY); }
  catch { return { ids: [], issue: "unavailable" }; }
  if (raw === null) return { ids: [], issue: null };
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed) || !parsed.every(validId)) return { ids: [], issue: "corrupt" };
    return { ids: [...new Set(parsed)], issue: null };
  } catch { return { ids: [], issue: "corrupt" }; }
}

function currentIds(): string[] {
  const state = readFavoritePlaces();
  if (state.issue) throw new Error(favoritePlacesMessage(state.issue));
  return state.ids;
}

function persist(ids: string[]): void {
  if (!writeJSON(FAVORITE_PLACES_KEY, ids)) throw new Error(favoritePlacesMessage("unavailable"));
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function getFavoritePlaceIds(): string[] {
  return readFavoritePlaces().ids;
}

export function isFavoritePlace(placeId: string): boolean {
  return getFavoritePlaceIds().includes(placeId);
}

export function toggleFavoritePlace(placeId: string): boolean {
  if (!validId(placeId)) throw new Error("Не вдалося визначити заклад для збереження.");
  const current = currentIds();
  const favorite = !current.includes(placeId);
  persist(favorite ? [...current, placeId] : current.filter((id) => id !== placeId));
  return favorite;
}

/** Removes only the requested entries, preserving favorites added in another tab. */
export function removeFavoritePlaces(ids: readonly string[]): void {
  const remove = new Set(ids);
  persist(currentIds().filter((id) => !remove.has(id)));
}

/** Used only by the explicit recovery action for a corrupt list. */
export function resetFavoritePlaces(): void { persist([]); }

export function subscribeToFavoritePlaces(refresh: () => void): () => void {
  const storage = (event: StorageEvent) => {
    if (event.key === FAVORITE_PLACES_KEY || event.key === null) refresh();
  };
  window.addEventListener(CHANGE_EVENT, refresh);
  window.addEventListener("storage", storage);
  window.addEventListener("focus", refresh);
  return () => {
    window.removeEventListener(CHANGE_EVENT, refresh);
    window.removeEventListener("storage", storage);
    window.removeEventListener("focus", refresh);
  };
}
