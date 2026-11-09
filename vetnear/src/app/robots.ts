import type { MetadataRoute } from "next";
import { SITE } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // /nearby and /admin are session/state-specific, not useful to index;
      // /products-nearby and /pet-scan are demos that are not launch-ready.
      disallow: ["/admin", "/nearby", "/products-nearby", "/pet-scan"],
    },
    sitemap: `${SITE.url}/sitemap.xml`,
    host: SITE.url,
  };
}
