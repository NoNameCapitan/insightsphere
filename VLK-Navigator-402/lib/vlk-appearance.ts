/**
 * Оформлення робочого місця: тема (світла / нічна / системна) і щільність.
 *
 * Це лише налаштування вигляду. Воно зберігається в цьому браузері й ніколи
 * не впливає на нормативні дані, класифікацію результатів чи склад зведення.
 */

export const APPEARANCE_KEY = "vlk-402-appearance-v1";

export type ThemePreference = "system" | "light" | "dark";
export type ResolvedTheme = "light" | "dark";
export type Density = "comfortable" | "compact";

export type Appearance = {
  theme: ThemePreference;
  density: Density;
};

export const DEFAULT_APPEARANCE: Appearance = { theme: "system", density: "comfortable" };

export const THEME_OPTIONS: readonly { id: ThemePreference; label: string }[] = [
  { id: "system", label: "Як у системі" },
  { id: "light", label: "Світла" },
  { id: "dark", label: "Нічна" },
];

export const DENSITY_OPTIONS: readonly { id: Density; label: string }[] = [
  { id: "comfortable", label: "Комфортно" },
  { id: "compact", label: "Щільно" },
];

const THEMES = new Set<string>(["system", "light", "dark"]);
const DENSITIES = new Set<string>(["comfortable", "compact"]);

/** Читає збережене оформлення з довільного (можливо, пошкодженого) значення. */
export function readAppearance(raw: unknown): Appearance {
  let parsed: unknown = raw;
  if (typeof raw === "string") {
    try {
      parsed = JSON.parse(raw);
    } catch {
      return { ...DEFAULT_APPEARANCE };
    }
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { ...DEFAULT_APPEARANCE };
  }

  const record = parsed as Record<string, unknown>;
  const theme =
    typeof record.theme === "string" && THEMES.has(record.theme)
      ? (record.theme as ThemePreference)
      : DEFAULT_APPEARANCE.theme;
  const density =
    typeof record.density === "string" && DENSITIES.has(record.density)
      ? (record.density as Density)
      : DEFAULT_APPEARANCE.density;

  return { theme, density };
}

export function serializeAppearance(appearance: Appearance) {
  return JSON.stringify({ version: 1, theme: appearance.theme, density: appearance.density });
}

/** Перетворює налаштування та системну підказку на фактичну тему. */
export function resolveTheme(theme: ThemePreference, systemPrefersDark: boolean): ResolvedTheme {
  if (theme === "dark") return "dark";
  if (theme === "light") return "light";
  return systemPrefersDark ? "dark" : "light";
}

/**
 * Скрипт, який виставляє тему та щільність до першого малювання.
 * Виконується у <head>, тому нічна тема не блимає білим на старті.
 */
export const APPEARANCE_BOOT_SCRIPT = `(function(){try{var raw=localStorage.getItem(${JSON.stringify(
  APPEARANCE_KEY,
)});var pref=raw?JSON.parse(raw):null;var theme=pref&&pref.theme?pref.theme:"system";var density=pref&&pref.density==="compact"?"compact":"comfortable";var dark=theme==="dark"||(theme!=="light"&&window.matchMedia("(prefers-color-scheme: dark)").matches);var root=document.documentElement;root.setAttribute("data-theme",dark?"dark":"light");root.setAttribute("data-density",density);}catch(error){}})();`;
