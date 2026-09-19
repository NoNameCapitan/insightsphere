import type { NextConfig } from "next";

// Жодних remotePatterns, зовнішніх шрифтів або аналітики.
const config: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  serverExternalPackages: ["better-sqlite3"],
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
