import { EVENT_CATEGORIES, type KyivEventCategory } from "@/lib/data/kyivUpdates";
import { readJSON, writeJSON } from "@/lib/storage";

export const EVENTS_PREFERENCES_KEY = "vetnear:events-preferences:v1";
export interface EventPreferences { savedIds: string[]; followedCategories: KyivEventCategory[]; }
export const emptyEventPreferences = (): EventPreferences => ({ savedIds: [], followedCategories: [] });

export function readEventPreferences(): EventPreferences {
  const raw = readJSON<unknown>(EVENTS_PREFERENCES_KEY, null);
  if (!raw || typeof raw !== "object") return emptyEventPreferences();
  const value = raw as Record<string, unknown>;
  return {
    savedIds: Array.isArray(value.savedIds) ? [...new Set(value.savedIds.filter((id): id is string => typeof id === "string" && id.length < 150))] : [],
    followedCategories: Array.isArray(value.followedCategories) ? [...new Set(value.followedCategories.filter((category): category is KyivEventCategory => EVENT_CATEGORIES.includes(category as KyivEventCategory)))] : [],
  };
}

function persist(preferences: EventPreferences): EventPreferences {
  if (!writeJSON(EVENTS_PREFERENCES_KEY, preferences)) throw new Error("Не вдалося зберегти вибір. Дозвольте зберігання даних у браузері та спробуйте ще раз.");
  return preferences;
}

export function toggleSavedEvent(id: string): EventPreferences {
  const current = readEventPreferences();
  return persist({ ...current, savedIds: current.savedIds.includes(id) ? current.savedIds.filter((saved) => saved !== id) : [...current.savedIds, id] });
}

export function toggleFollowedCategory(category: KyivEventCategory): EventPreferences {
  const current = readEventPreferences();
  return persist({ ...current, followedCategories: current.followedCategories.includes(category) ? current.followedCategories.filter((saved) => saved !== category) : [...current.followedCategories, category] });
}
