import type { Config } from "tailwindcss";

/**
 * Design reminder — Care Field Notes: calm local guidance with a clear,
 * safety-first emergency signal. These are presentation tokens only; routes,
 * data and product logic are intentionally unchanged.
 * Palette: trustworthy teal "animal-medical" base + one unmistakable emergency rose.
 * The rings/pulse motif is the product signature (search radius made visible).
 */
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#152320", // warm near-black ink
        canvas: "#F7F9F6", // pearl mineral base
        surface: "#FFFFFF",
        // Warm pet-care accent — used for emotion (aura, care details, tints),
        // never for urgent actions (rose stays reserved for emergency).
        peach: {
          DEFAULT: "#E3A487",
          50: "#FCF4EE",
          100: "#F8E5D9",
          200: "#EFD0BE",
          700: "#A65F45",
        },
        brand: {
          DEFAULT: "#126E66", // warmer refined teal
          50: "#EEF8F4",
          100: "#DCEFE8",
          200: "#B9DDD2",
          300: "#83C7B8",
          400: "#48A998",
          500: "#126E66",
          600: "#0F625B",
          700: "#0B5752",
          800: "#08433F",
          900: "#06322F",
        },
        emergency: {
          DEFAULT: "#C94F57", // reserved strictly for emergency
          50: "#FFF3F3",
          100: "#FDE0E2",
          600: "#B23F48",
          700: "#8F3038",
        },
        amber: {
          DEFAULT: "#D97706", // "open now" / caution
        },
      },
      fontFamily: {
        // No external font CDN dependency: a curated, distinctive system stack.
        display: [
          "'Onest'",
          "'SF Pro Display'",
          "'Segoe UI'",
          "Roboto",
          "system-ui",
          "sans-serif",
        ],
        sans: [
          "system-ui",
          "-apple-system",
          "'Segoe UI'",
          "Roboto",
          "Helvetica",
          "Arial",
          "sans-serif",
        ],
      },
      borderRadius: {
        xl: "0.875rem",
        "2xl": "1.25rem",
        "3xl": "1.5rem",
      },
      boxShadow: {
        card: "0 1px 2px rgba(15,42,46,0.04), 0 12px 28px -22px rgba(15,42,46,0.2)",
        pop: "0 24px 56px -32px rgba(15,42,46,0.3)",
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
