import type { NextConfig } from "next";

// Жодних remotePatterns, зовнішніх шрифтів або аналітики.
const config: NextConfig = {
  // Локально збирається самодостатній standalone-сервер.
  // На Vercel збірку пакує сама платформа, тому режим вимикається.
  output: process.env.VERCEL ? undefined : "standalone",
  poweredByHeader: false,
  // Стамп збірки для версії кешу оболонки в браузері.
  // Не містить жодних даних установи.
  env: { VLK_BUILD_STAMP: process.env.VLK_BUILD_STAMP || String(Date.now()) },
  serverExternalPackages: ["better-sqlite3", "@libsql/client"],
  experimental: { serverActions: { bodySizeLimit: "2mb" } },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "no-referrer" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          { key: "Cache-Control", value: "private, no-store, max-age=0" },
          {
            key: "Content-Security-Policy",
            value:
              "default-src 'self'; script-src 'self' 'unsafe-inline'" +
              (process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : "") +
              "; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; form-action 'self'; base-uri 'self'; object-src 'none'",
          },
        ],
      },
    ];
  },
};
export default config;
