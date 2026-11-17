// Theme foundation (v1.35). One source of truth for how the colour scheme is
// chosen, stored and applied — shared by the no-flash bootstrap script in the
// root layout, the toggle and the tests.
//
// Preference: "system" (follow the OS), "light" or "dark".
// Applied theme: the resolved "light" | "dark", written to <html data-theme>.
// Every colour in the app reads CSS variables keyed off that attribute
// (src/app/theme.css), so components never branch on the theme in JS.

export type ThemePreference = "system" | "light" | "dark";
export type AppliedTheme = "light" | "dark";

export const THEME_STORAGE_KEY = "vetnear:theme";
export const THEME_PREFERENCES: readonly ThemePreference[] = ["system", "light", "dark"];
export const THEME_CHANGED_EVENT = "vetnear:theme-changed";

/** Browser chrome colour per applied theme (status bar, PWA title bar). */
export const THEME_COLOR: Record<AppliedTheme, string> = { light: "#F7F4ED", dark: "#14130F" };

export function isThemePreference(value: unknown): value is ThemePreference {
  return value === "system" || value === "light" || value === "dark";
}

export function resolveTheme(preference: ThemePreference, systemPrefersDark: boolean): AppliedTheme {
  if (preference === "system") return systemPrefersDark ? "dark" : "light";
  return preference;
}

/** The next preference when the toggle is pressed: system → light → dark → system. */
export function nextPreference(current: ThemePreference): ThemePreference {
  return THEME_PREFERENCES[(THEME_PREFERENCES.indexOf(current) + 1) % THEME_PREFERENCES.length];
}

export const THEME_LABEL: Record<ThemePreference, string> = {
  system: "Як у системі",
  light: "Світла",
  dark: "Темна",
};

/**
 * Inline script for <head>: applies the theme before first paint, so a dark
 * page never flashes white. Tiny, dependency-free and failure-safe (storage
 * may be blocked). It contains no user input.
 */
export const THEME_BOOTSTRAP_SCRIPT = `(function(){try{var k=${JSON.stringify(THEME_STORAGE_KEY)},p=null;try{p=localStorage.getItem(k)}catch(e){}if(p!=="light"&&p!=="dark")p="system";var d=p==="dark"||(p==="system"&&!!window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches);var r=document.documentElement;r.setAttribute("data-theme",d?"dark":"light");r.setAttribute("data-theme-preference",p);r.style.colorScheme=d?"dark":"light";}catch(e){}})();`;

/** Reads the stored preference; anything unexpected falls back to "system". */
export function readThemePreference(): ThemePreference {
  try {
    const value = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isThemePreference(value) ? value : "system";
  } catch {
    return "system";
  }
}

function systemPrefersDark(): boolean {
  return typeof window !== "undefined" && Boolean(window.matchMedia?.("(prefers-color-scheme: dark)").matches);
}

/** Applies a preference to the document and remembers it (best effort). */
export function applyThemePreference(preference: ThemePreference, persist = true): AppliedTheme {
  const applied = resolveTheme(preference, systemPrefersDark());
  const root = document.documentElement;
  root.setAttribute("data-theme", applied);
  root.setAttribute("data-theme-preference", preference);
  root.style.colorScheme = applied;
  document.querySelectorAll('meta[name="theme-color"]').forEach((meta) => meta.setAttribute("content", THEME_COLOR[applied]));
  if (persist) {
    try {
      if (preference === "system") window.localStorage.removeItem(THEME_STORAGE_KEY);
      else window.localStorage.setItem(THEME_STORAGE_KEY, preference);
    } catch {
      /* the choice still applies to this page */
    }
  }
  window.dispatchEvent(new CustomEvent(THEME_CHANGED_EVENT, { detail: { preference, applied } }));
  return applied;
}
