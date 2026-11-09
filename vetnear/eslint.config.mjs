// Flat config for ESLint 9 + eslint-config-next 16 (Next 16 removed `next lint`).
// Uses eslint-config-next's native flat config. We keep the same effective rule
// strictness as the previous `next/core-web-vitals` setup by disabling the newer
// advisory rules that the upgraded react-hooks plugin introduced (they flag
// accepted patterns like initialising state from storage in an effect, not bugs).
import next from "eslint-config-next/core-web-vitals";

export default [
  ...next,
  {
    rules: {
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/static-components": "off",
    },
  },
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "scripts/**",
      "next-env.d.ts",
      "*.config.mjs",
      "*.config.js",
      "*.config.ts",
    ],
  },
];
