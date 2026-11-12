import type { Config } from "tailwindcss";

/**
 * Design reminder — Care Field Notes: calm local guidance with a clear,
 * safety-first emergency signal. These are presentation tokens only; routes,
 * data and product logic are intentionally unchanged.
 * Palette (v1.23): warm ivory canvas, deep/fresh teal + mint signature, one
 * apricot accent, and an emergency red that is never used decoratively.
 * The rings/pulse motif is the product signature (search radius made visible).
 */
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#142B28", // warm deep ink
        canvas: "#FBF8F3", // warm ivory base (not hospital white)
        surface: "#FBFDFC", // off-white with a 2% green tint
        // Apricot — the single warm accent. Emotion only (aura, care details),
        // never for urgent actions (red stays reserved for emergency).
        peach: {
          DEFAULT: "#F2A47E",
          50: "#FEF6F0",
          100: "#FBE8DB",
          200: "#F6D2BD",
          700: "#A8573A",
        },
        brand: {
          DEFAULT: "#06756A", // deep teal, a touch more saturated (5.6:1 on white)
          50: "#EEF9F5", // mint wash
          100: "#DDF3EB",
          200: "#BCE7D9", // mint
          300: "#86D3BF",
          400: "#12A892", // fresh teal: icons and active states, not body text
          500: "#06756A",
          600: "#05685E",
          700: "#045A52",
          800: "#034640",
          900: "#02332F",
        },
        emergency: {
          DEFAULT: "#CF4436", // warm coral red — reserved strictly for emergency
          50: "#FFF4F1",
          100: "#FDE3DD",
          600: "#B5382C",
          700: "#8F2B22",
        },
        amber: {
          DEFAULT: "#B26A12", // caution / alert text; tints come from opacity
        },
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
