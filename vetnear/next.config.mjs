import path from "node:path";

const STANDALONE = process.env.NEXT_OUTPUT === "standalone";
const isProd = process.env.NODE_ENV === "production";

// Content-Security-Policy.
// Notes on relaxed directives (documented in SECURITY.md):
// - 'unsafe-inline' (script/style): Next.js injects inline bootstrap scripts and
//   Leaflet injects inline styles; without a nonce pipeline these are required.
// - 'unsafe-eval' (dev only): React Fast Refresh needs it in development.
// - img-src https: and connect-src https:: required for OpenStreetMap raster
//   tiles + OSRM routing + Nominatim geocoding (all third-party HTTPS hosts).
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isProd ? "" : " 'unsafe-eval'"}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "connect-src 'self' https:",
  "font-src 'self' data:",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  ...(isProd ? ["upgrade-insecure-requests"] : []),
].join("; ");

const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(self), microphone=(), geolocation=(self), payment=()",
  },
  { key: "Content-Security-Policy", value: csp },
  // HSTS only in production (HTTPS). Harmless to send; gated to avoid local HTTP pain.
  ...(isProd
    ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }]
    : []),
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // No next/image optimizer — plain <img>/Leaflet only.
  images: { remotePatterns: [], unoptimized: true },

  // Build worker pool capped to 1 (memory/IPC) for constrained CI.
  experimental: { cpus: 1 },

  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },

  ...(STANDALONE
    ? { output: "standalone", outputFileTracingRoot: path.join(import.meta.dirname) }
    : {}),
};

export default nextConfig;
