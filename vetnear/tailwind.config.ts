import type { Config } from "tailwindcss";

/**
 * VetNear design tokens.
 * Palette: trustworthy teal "animal-medical" base + one unmistakable emergency rose.
 * The rings/pulse motif is the product signature (search radius made visible).
 */
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0F2A2E", // deep teal-charcoal text
        canvas: "#F3F7F5", // soft mint-gray page background
        surface: "#FFFFFF",
        brand: {
          DEFAULT: "#0E7C66", // deep trustworthy teal
          50: "#E8F5F1",
          100: "#CDEBE2",
          200: "#9BD7C6",
          300: "#5FBEA6",
          400: "#2EA487",
          500: "#0E7C66",
          600: "#0B6353",
          700: "#094C40",
          800: "#06352D",
          900: "#04211C",
        },
        emergency: {
          DEFAULT: "#E11D48", // signature — reserved strictly for emergency
          50: "#FFF1F4",
          100: "#FFE0E7",
          600: "#C20E38",
          700: "#9F0A2C",
        },
        amber: {
          DEFAULT: "#D97706", // "open now" / caution
        },
      },
      fontFamily: {
        // No external font CDN dependency: a curated, distinctive system stack.
        display: [
          "ui-rounded",
          "'SF Pro Rounded'",
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
        xl: "1rem",
        "2xl": "1.5rem",
        "3xl": "2rem",
      },
      boxShadow: {
        card: "0 1px 2px rgba(15,42,46,0.06), 0 8px 24px -12px rgba(15,42,46,0.18)",
        pop: "0 12px 40px -12px rgba(15,42,46,0.28)",
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
