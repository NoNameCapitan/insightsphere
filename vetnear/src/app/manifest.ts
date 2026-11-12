import type { MetadataRoute } from "next";
import { t } from "@/lib/i18n";
import { SITE } from "@/lib/seo";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${SITE.name} — ${t.tagline}`,
    short_name: SITE.name,
    description: t.hero.subtitle,
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#FBF8F3",
    theme_color: "#06756A",
    lang: "uk",
    categories: ["medical", "lifestyle", "navigation"],
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
