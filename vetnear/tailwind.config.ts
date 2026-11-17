import type { Config } from "tailwindcss";

/**
 * Design reminder — Care Field Notes: calm local guidance with a clear,
 * safety-first emergency signal. These are presentation tokens only; routes,
 * data and product logic are intentionally unchanged.
 * Palette (v1.23): warm ivory canvas, deep/fresh teal + mint signature, one
 * apricot accent, and an emergency red that is never used decoratively.
 * The rings/pulse motif is the product signature (search radius made visible).
 */
/** A theme colour that keeps Tailwind's opacity modifiers working (bg-brand/10). */
const v = (name: string) => `rgb(var(--c-${name}) / <alpha-value>)`;

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      // Every colour is a CSS variable (src/app/theme.css), so the whole
      // utility layer follows <html data-theme="light|dark"> automatically.
      // Light values are unchanged from v1.34; dark values live in theme.css.
      colors: {
        ink: v("ink"), // primary text
        canvas: v("canvas"), // page background
        surface: v("surface"), // cards, sheets, inputs
        // Apricot — the single warm accent. Emotion only, never urgent actions.
        peach: { DEFAULT: v("peach"), 50: v("peach-50"), 100: v("peach-100"), 200: v("peach-200"), 700: v("peach-700") },
        brand: {
          DEFAULT: v("brand"), // filled actions (white text on top)
          50: v("brand-50"), // soft tinted backgrounds
          100: v("brand-100"), // hairlines
          200: v("brand-200"),
          300: v("brand-300"),
          400: v("brand-400"), // icons and active states, not body text
          500: v("brand"),
          600: v("brand-600"),
          700: v("brand-700"), // strong brand text
          800: v("brand-800"),
          900: v("brand-900"),
        },
        // Reserved strictly for emergency.
        emergency: { DEFAULT: v("emergency"), 50: v("emergency-50"), 100: v("emergency-100"), 600: v("emergency-600"), 700: v("emergency-700") },
        amber: { DEFAULT: v("amber") }, // caution / alert text
      },
      fontFamily: {
        // One self-hosted variable typeface (@fontsource) with full Cyrillic.
        display: ["'Manrope Variable'", "system-ui", "-apple-system", "'Segoe UI'", "sans-serif"],
        sans: ["'Manrope Variable'", "system-ui", "-apple-system", "'Segoe UI'", "sans-serif"],
      },
      borderRadius: {
        xl: "0.875rem",
        "2xl": "1.25rem",
        "3xl": "1.5rem",
      },
      boxShadow: {
        card: "0 1px 2px rgba(11,80,72,0.04), 0 14px 30px -22px rgba(11,80,72,0.22)",
        pop: "0 26px 58px -32px rgba(11,80,72,0.32)",
      },
      keyframes: {
        ping2: {
          "0%": { transform: "scale(1)", opacity: "0.55" },
          "80%, 100%": { transform: "scale(2.4)", opacity: "0" },
        },
        rise: {
          "0%": { transform: "translateY(8px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
      },
      animation: {
        ping2: "ping2 2.4s cubic-bezier(0,0,0.2,1) infinite",
        rise: "rise 0.45s ease-out both",
      },
    },
  },
  plugins: [],
};

export default config;
