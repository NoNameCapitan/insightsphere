import type { MetadataRoute } from "next";
import { PLACES } from "@/lib/data/places";
import { ALL_DISTRICTS } from "@/lib/labels";
import { SITE } from "@/lib/seo";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const staticRoutes = [
    "",
    "/my-pets",
    "/my-pets/new",
    "/nearby",
    "/products-nearby",
    "/assistant",
    "/pet-scan",
    "/lost-found",
    "/questionnaire",
    "/add-place",
    "/for-partners",
    // SEO landings
    "/pet-services-near-me",
    "/pet-map-kyiv",
    "/vet-clinic-near-me",
    "/emergency-vet-near-me",
    "/pet-store-near-me",
    "/vet-pharmacy-near-me",
    "/grooming-near-me",
    "/city/kyiv/pet-services",
    "/city/kyiv/vet-clinics",
    "/city/kyiv/pet-stores",
    "/city/kyiv/vet-pharmacies",
    "/city/kyiv/grooming",
    "/city/kyiv/shelters",
  ];

  const staticEntries: MetadataRoute.Sitemap = staticRoutes.map((path) => ({
    url: `${SITE.url}${path}`,
    lastModified: now,
    changeFrequency: "weekly",
    priority: path === "" ? 1 : 0.7,
  }));

  const districtEntries: MetadataRoute.Sitemap = ALL_DISTRICTS.map((d) => ({
    url: `${SITE.url}/city/kyiv/district/${d}`,
    lastModified: now,
    changeFrequency: "weekly",
    priority: 0.6,
  }));

  const placeEntries: MetadataRoute.Sitemap = PLACES.map((p) => ({
    url: `${SITE.url}/place/${p.slug}`,
    lastModified: new Date(p.updatedAt),
    changeFrequency: "monthly",
    priority: 0.5,
  }));

  return [...staticEntries, ...districtEntries, ...placeEntries];
}
