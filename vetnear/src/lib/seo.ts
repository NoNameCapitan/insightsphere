import type { Place, PlaceCategory } from "./types";

export const SITE = {
  name: "VetNear",
  url:
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
    "https://vetnear.example.com",
  locale: "uk_UA",
  twitter: "@vetnear",
};

/** Map place categories to schema.org @type values. */
export function schemaTypeFor(category: PlaceCategory): string {
  switch (category) {
    case "veterinary_clinic":
    case "emergency_vet":
      return "VeterinaryCare";
    case "vet_pharmacy":
      return "Pharmacy";
    case "pet_store":
      return "PetStore";
    default:
      return "LocalBusiness";
  }
}

export function placeJsonLd(place: Place) {
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
      addressLocality: "Kyiv",
      addressCountry: "UA",
    },
    geo: {
      "@type": "GeoCoordinates",
      latitude: place.latitude,
      longitude: place.longitude,
    },
    aggregateRating:
      place.rating > 0
        ? {
            "@type": "AggregateRating",
            ratingValue: place.rating,
            bestRating: 5,
            ratingCount: Math.round(place.rating * 23),
          }
        : undefined,
    openingHours: place.isOpen24_7 ? "Mo-Su 00:00-23:59" : undefined,
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
