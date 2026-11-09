import type { Metadata } from "next";

// These routes depend on per-user browser state (localStorage / geolocation /
// Leaflet map). They are intentionally NOT pre-rendered: rendering them during
// `next build` adds no value (no stable static content) and unnecessarily loads
// the client graph into the static-generation workers. Rendering on demand keeps
// the build fast and deterministic across environments.
export const dynamic = "force-dynamic";

// Not launch-ready (the catalogue is demo data): reachable by direct URL only,
// kept out of navigation, the sitemap and search indexes.
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function SegmentLayout({ children }: { children: React.ReactNode }) {
  return children;
}
