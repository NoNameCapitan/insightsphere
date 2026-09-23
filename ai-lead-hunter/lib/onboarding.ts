// Pure logic for the setup wizard: step order, env snippet, completion state.
// No DOM access in the pure functions; the small localStorage wrappers are
// SSR-safe and only used by the wizard component.

export type WizardMode = "demo" | "real";

export type WizardStep = "mode" | "source" | "configure" | "verify";

export const WIZARD_STEPS: Array<{ key: WizardStep; label: string }> = [
  { key: "mode", label: "Режим" },
  { key: "source", label: "Джерело" },
  { key: "configure", label: "Налаштування" },
  { key: "verify", label: "Перевірка" },
];

/** Ordered step list for a given mode. Demo mode skips source/configure. */
export function stepsForMode(mode: WizardMode | null): WizardStep[] {
  if (mode === "demo") return ["mode", "verify"];
  return ["mode", "source", "configure", "verify"];
}

export function nextStep(
  current: WizardStep,
  mode: WizardMode | null,
): WizardStep | null {
  const seq = stepsForMode(mode);
  const i = seq.indexOf(current);
  return i >= 0 && i < seq.length - 1 ? seq[i + 1] : null;
}

export function prevStep(
  current: WizardStep,
  mode: WizardMode | null,
): WizardStep | null {
  const seq = stepsForMode(mode);
  const i = seq.indexOf(current);
  return i > 0 ? seq[i - 1] : null;
}

/** Progress as a 1-based index / total for the chosen mode. */
export function stepProgress(
  current: WizardStep,
  mode: WizardMode | null,
): { index: number; total: number } {
  const seq = stepsForMode(mode);
  const i = seq.indexOf(current);
  return { index: (i < 0 ? 0 : i) + 1, total: seq.length };
}

/** Ready-to-paste .env.local snippet. Never contains a real key. */
export function buildEnvSnippet(opts: { withMaps: boolean }): string {
  const lines = [
    "# AI Lead Hunter — real Google Places mode",
    "GOOGLE_PLACES_API_KEY=ВАШ_КЛЮЧ_PLACES",
    "NEXT_PUBLIC_DEMO_MODE=false",
  ];
  if (opts.withMaps) {
    lines.push("NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY=ВАШ_BROWSER_КЛЮЧ_MAPS");
  }
  return lines.join("\n") + "\n";
}

export const GOOGLE_CLOUD_CREDENTIALS_URL =
  "https://console.cloud.google.com/apis/credentials";
export const GOOGLE_PLACES_LIBRARY_URL =
  "https://console.cloud.google.com/apis/library/places.googleapis.com";
export const GOOGLE_MAPS_JS_LIBRARY_URL =
  "https://console.cloud.google.com/apis/library/maps-backend.googleapis.com";

const DONE_KEY = "alh_onboarding_done_v1";
const FORCE_DEMO_KEY = "alh_force_demo";

export function isOnboardingDone(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(DONE_KEY) === "true";
  } catch {
    return false;
  }
}

export function markOnboardingDone(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(DONE_KEY, "true");
  } catch {
    /* ignore */
  }
}

export function resetOnboarding(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(DONE_KEY);
  } catch {
    /* ignore */
  }
}

/** Persist the explicit demo choice so search uses demo without env changes. */
export function setForceDemo(on: boolean): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(FORCE_DEMO_KEY, on ? "true" : "false");
  } catch {
    /* ignore */
  }
}
