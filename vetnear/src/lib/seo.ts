import { categoryMap } from "@/config/vertical";
import { VERTICAL } from "@/config/verticals/pet-care-kyiv";
import { COVERAGE_REGIONS, localityOf, regionOf } from "@/config/coverage";
import type { Place, PlaceCategory } from "./types";
import { isEmergencySearchSafe } from "@/lib/data/verification";

export const SITE = {
  name: VERTICAL.productName,
  url:
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
    "https://vetnear.example.com",
  locale: "uk_UA",
  twitter: "@vetnear",
  /** Public contact for privacy / data requests. Set before launch. */
  contactEmail: process.env.NEXT_PUBLIC_CONTACT_EMAIL?.trim() || "",
};

const SCHEMA_TYPES: Record<PlaceCategory, string> = categoryMap(
  VERTICAL,
  (c) => c.schemaType,
);

/** Map place categories to schema.org @type values (from the vertical config). */
export function schemaTypeFor(category: PlaceCategory): string {
  return SCHEMA_TYPES[category] ?? "LocalBusiness";
}

export function placeJsonLd(place: Place, now: Date = new Date()) {
  return {
    "@context": "https://schema.org",
    "@type": schemaTypeFor(place.category),
    name: place.name,
    description: place.description,
    telephone: place.phone,
    url: place.website,
    address: {
      "@type": "PostalAddress",
      streetAddress: place.address,
      addressLocality: localityOf(place) || undefined,
      addressRegion: COVERAGE_REGIONS[regionOf(place)],
      addressCountry: place.countryCode ?? "UA",
    },
    geo: {
      "@type": "GeoCoordinates",
      latitude: place.latitude,
      longitude: place.longitude,
    },
    // No aggregateRating until a real review count and its provenance exist.
    // A star score cannot be converted into an invented number of reviews.
    openingHours: place.isOpen24_7 && isEmergencySearchSafe(place, now) ? "Mo-Su 00:00-23:59" : undefined,
  };
}

export function itemListJsonLd(places: Place[], pageUrl: string) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    url: pageUrl,
    numberOfItems: places.length,
    itemListElement: places.map((p, i) => ({
      "@type": "ListItem",
      position: i + 1,
      item: placeJsonLd(p),
    })),
  };
}

export function websiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE.name,
    url: SITE.url,
    potentialAction: {
      "@type": "SearchAction",
      target: `${SITE.url}/nearby?q={search_term_string}`,
      "query-input": "required name=search_term_string",
    },
  };
}
