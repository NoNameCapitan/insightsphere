"use client";

import { useEffect, useState } from "react";
import {
  THEME_LABEL,
  applyThemePreference,
  nextPreference,
  readThemePreference,
  type ThemePreference,
} from "@/lib/theme/theme";

/** One compact button: system → light → dark. The page never flashes on load. */
export function ThemeToggle() {
  // Rendered as "system" on the server; the stored value arrives after mount.
  const [preference, setPreference] = useState<ThemePreference>("system");

  useEffect(() => {
    setPreference(readThemePreference());
    // Colour cross-fades are enabled only after first paint (see theme.css).
    const ready = requestAnimationFrame(() => document.documentElement.setAttribute("data-theme-ready", ""));
    // Follow the OS while the preference is "system".
    const query = window.matchMedia?.("(prefers-color-scheme: dark)");
    const onChange = () => {
      if (readThemePreference() === "system") applyThemePreference("system", false);
    };
    query?.addEventListener("change", onChange);
    // Paper is always light: print with the light palette, then restore.
    const root = document.documentElement;
    let beforePrint: string | null = null;
    const onBeforePrint = () => {
      beforePrint = root.getAttribute("data-theme");
      root.setAttribute("data-theme", "light");
    };
    const onAfterPrint = () => {
      if (beforePrint) root.setAttribute("data-theme", beforePrint);
      beforePrint = null;
    };
    window.addEventListener("beforeprint", onBeforePrint);
    window.addEventListener("afterprint", onAfterPrint);
    return () => {
      cancelAnimationFrame(ready);
      query?.removeEventListener("change", onChange);
      window.removeEventListener("beforeprint", onBeforePrint);
      window.removeEventListener("afterprint", onAfterPrint);
    };
  }, []);

  const next = nextPreference(preference);
  return (
    <button
      type="button"
      className="theme-toggle"
      data-preference={preference}
      aria-label={`Тема: ${THEME_LABEL[preference].toLowerCase()}. Змінити на «${THEME_LABEL[next].toLowerCase()}»`}
      title={`Тема: ${THEME_LABEL[preference]}`}
      onClick={() => {
        applyThemePreference(next);
        setPreference(next);
      }}
    >
      <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        {preference === "dark" ? (
          <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" />
        ) : preference === "light" ? (
          <>
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2.5v2M12 19.5v2M4.6 4.6 6 6M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4" />
          </>
        ) : (
          <>
            <circle cx="12" cy="12" r="8.5" />
            <path d="M12 3.5a8.5 8.5 0 0 1 0 17Z" fill="currentColor" stroke="none" />
          </>
        )}
      </svg>
    </button>
  );
}
