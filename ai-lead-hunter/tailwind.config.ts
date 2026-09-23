import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Single confident primary — deep indigo, used with restraint.
        brand: {
          50: "#eef8f5",
          100: "#d9eee6",
          200: "#b4ddcd",
          300: "#84c5ad",
          400: "#50a88b",
          500: "#2e8a6e",
          600: "#16745b",
          700: "#115d4a",
          800: "#134b3d",
          900: "#123f34",
        },
        // Lead-temperature scale — encodes the score, not decoration.
        hot: "#059669",
        warm: "#d97706",
        cold: "#0284c7",
        bad: "#64748b",
        ink: "#192c28",
        paper: "#f6f8f7",
      },
      fontFamily: {
        sans: [
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "Inter",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
        mono: [
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "Consolas",
          "monospace",
        ],
      },
      boxShadow: {
        card: "0 1px 2px rgba(15,18,34,0.06), 0 8px 24px -12px rgba(15,18,34,0.18)",
      },
      borderRadius: {
        xl2: "1.125rem",
      },
    },
  },
  plugins: [],
};
export default config;
