import { SESSION_KEY, LEGACY_SESSION_KEYS } from "./vlk-session.ts";
import { SEARCH_HISTORY_KEY } from "./vlk-search-history.ts";
import { WORKSPACE_KEY } from "./vlk-workspace.ts";

type LocalStore = Pick<Storage, "getItem" | "setItem" | "removeItem">;
export const SESSION_RESET_KEY = "vlk-402-session-reset";
export const SESSION_DATA_KEYS = [SESSION_KEY, ...LEGACY_SESSION_KEYS, SEARCH_HISTORY_KEY, WORKSPACE_KEY];

function browserStorage(): LocalStore | undefined {
  try { return typeof localStorage === "undefined" ? undefined : localStorage; }
  catch { return undefined; }
}

export function readStored(key: string, storage = browserStorage()): string | null {
  try { return storage?.getItem(key) ?? null; } catch { return null; }
}

export function writeStored(key: string, value: string, storage = browserStorage()): boolean {
  try { if (!storage) return false; storage.setItem(key, value); return true; }
  catch { return false; }
}

/** Only session data: preserve the theme, offline corpus and unrelated apps. */
export function clearStoredSession(storage = browserStorage()): boolean {
  if (!storage) return false;
  let success = true;
  for (const key of SESSION_DATA_KEYS) {
    try { storage.removeItem(key); } catch { success = false; }
  }
  // Notify other v19 tabs so their in-memory copy cannot restore the old basket.
  if (!writeStored(SESSION_RESET_KEY, `${Date.now()}-${Math.random()}`, storage)) success = false;
  return success;
}
