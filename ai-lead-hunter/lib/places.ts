// Niche metadata + Google Places API (v1) integration.
// All Google calls happen server-side; the API key is never sent to the browser.

import { ApiError } from "./errors";
import type { NicheKey, RawBusiness, SearchRequest } from "./types";

export type NicheMeta = {
  key: NicheKey;
  labelUk: string;
  appointmentBased: boolean; // booking / chatbot offers fit well
  highValue: boolean; // higher customer LTV -> better timing
  competitive: boolean; // crowded niche -> few reviews is a real problem
  expectedMinReviews: number;
  queries: string[]; // multilingual expansion for Text Search
  googleTypes: string[]; // Places "types" that map to this niche
};

export const NICHES: Record<NicheKey, NicheMeta> = {
  beauty: {
    key: "beauty",
    labelUk: "Салон краси",
    appointmentBased: true,
    highValue: false,
    competitive: true,
    expectedMinReviews: 25,
    queries: ["салон краси", "салон красоты", "beauty salon", "nail salon"],
    googleTypes: ["beauty_salon", "hair_care", "nail_salon"],
  },
  dental: {
    key: "dental",
    labelUk: "Стоматологія",
    appointmentBased: true,
    highValue: true,
    competitive: true,
    expectedMinReviews: 30,
    queries: ["стоматологія", "стоматология", "dental clinic", "dentist"],
    googleTypes: ["dentist", "dental_clinic"],
  },
  vet: {
    key: "vet",
    labelUk: "Ветклініка",
    appointmentBased: true,
    highValue: true,
    competitive: false,
    expectedMinReviews: 20,
    queries: ["ветклініка", "ветклиника", "veterinary clinic", "vet clinic"],
    googleTypes: ["veterinary_care"],
  },
  carwash: {
    key: "carwash",
    labelUk: "Автомийка",
    appointmentBased: false,
    highValue: false,
    competitive: true,
    expectedMinReviews: 15,
    queries: ["автомийка", "автомойка", "car wash"],
    googleTypes: ["car_wash"],
  },
  cafe: {
    key: "cafe",
    labelUk: "Кафе",
    appointmentBased: false,
    highValue: false,
    competitive: true,
    expectedMinReviews: 40,
    queries: ["кафе", "cafe", "coffee shop", "кав'ярня"],
    googleTypes: ["cafe", "coffee_shop"],
  },
  fitness: {
    key: "fitness",
    labelUk: "Фітнес / спортзал",
    appointmentBased: true,
    highValue: true,
    competitive: true,
    expectedMinReviews: 30,
    queries: ["фітнес", "фитнес", "gym", "fitness club"],
    googleTypes: ["gym", "fitness_center"],
  },
  auto_service: {
    key: "auto_service",
    labelUk: "Автосервіс / СТО",
    appointmentBased: true,
    highValue: true,
    competitive: false,
    expectedMinReviews: 20,
    queries: ["автосервіс", "автосервис", "сто", "car repair", "auto service"],
    googleTypes: ["car_repair"],
  },
  medical: {
    key: "medical",
    labelUk: "Медичний центр",
    appointmentBased: true,
    highValue: true,
    competitive: true,
    expectedMinReviews: 30,
    queries: ["медичний центр", "медцентр", "medical clinic", "clinic"],
    googleTypes: ["doctor", "medical_clinic", "hospital"],
  },
  repair: {
    key: "repair",
    labelUk: "Ремонт / сервіс",
    appointmentBased: false,
    highValue: false,
    competitive: false,
    expectedMinReviews: 15,
    queries: ["ремонт", "сервісний центр", "repair service"],
    // Never the generic "store" type: it would turn bakeries/pharmacies into repair.
    googleTypes: ["electronics_store", "cell_phone_store", "electrician", "plumber", "locksmith"],
  },
  restaurant: {
    key: "restaurant",
    labelUk: "Ресторан",
    appointmentBased: false,
    highValue: false,
    competitive: true,
    expectedMinReviews: 50,
    queries: ["ресторан", "restaurant"],
    googleTypes: ["restaurant"],
  },
  generic: {
    key: "generic",
    labelUk: "Локальний бізнес",
    appointmentBased: false,
    highValue: false,
    competitive: false,
    expectedMinReviews: 15,
    queries: ["local business"],
    googleTypes: [],
  },
};

export function nicheToQueries(niche: NicheKey): string[] {
  return NICHES[niche]?.queries ?? NICHES.generic.queries;
}

export function detectNicheFromTypes(
  types: string[] = [],
  preferred?: NicheKey,
): NicheKey {
  const set = new Set(types);
  // A place that matches the requested niche keeps it (a cafe-restaurant found
  // by a restaurant search stays a restaurant).
  if (
    preferred &&
    preferred !== "generic" &&
    NICHES[preferred].googleTypes.some((t) => set.has(t))
  )
    return preferred;
  for (const key of Object.keys(NICHES) as NicheKey[]) {
    if (key === "generic") continue;
    if (NICHES[key].googleTypes.some((t) => set.has(t))) return key;
  }
  return "generic";
}

// ---- Google Places API (v1) ----

type PlaceV1 = {
  id?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  location?: { latitude?: number; longitude?: number };
  nationalPhoneNumber?: string;
  internationalPhoneNumber?: string;
  websiteUri?: string;
  rating?: number;
  userRatingCount?: number;
  regularOpeningHours?: { openNow?: boolean; weekdayDescriptions?: string[] };
  currentOpeningHours?: { openNow?: boolean };
  businessStatus?: string;
  googleMapsUri?: string;
  types?: string[];
  attributions?: { provider: string; providerUri?: string }[];
};

const FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.location",
  "places.nationalPhoneNumber",
  "places.internationalPhoneNumber",
  "places.websiteUri",
  "places.rating",
  "places.userRatingCount",
  "places.regularOpeningHours",
  "places.businessStatus",
  "places.googleMapsUri",
  "places.types",
  "places.attributions",
  "places.currentOpeningHours.openNow",
  "nextPageToken",
].join(",");

function normalizePlaceV1(p: PlaceV1, fallbackNiche: NicheKey): RawBusiness {
  const types = p.types ?? [];
  const detected = detectNicheFromTypes(types, fallbackNiche);
  return {
    source: "google_places",
    sourcePlaceId: p.id,
    attributions: p.attributions,
    name: p.displayName?.text ?? "Без назви",
    niche: detected === "generic" ? fallbackNiche : detected,
    category: NICHES[detected === "generic" ? fallbackNiche : detected].labelUk,
    address: p.formattedAddress ?? "",
    lat: p.location?.latitude,
    lng: p.location?.longitude,
    phone: p.internationalPhoneNumber ?? p.nationalPhoneNumber,
    website: p.websiteUri,
    googleMapsUrl: p.googleMapsUri,
    rating: p.rating,
    reviewCount: p.userRatingCount,
    openingHours: p.regularOpeningHours?.weekdayDescriptions,
    isOpenNow: p.currentOpeningHours?.openNow ?? p.regularOpeningHours?.openNow,
    businessStatus: p.businessStatus,
  };
}

// Bounded pagination: at most 6 billable requests per search, 9 on "Search more".
export async function searchGooglePlaces(
  req: SearchRequest,
  apiKey: string,
  opts: { widen?: number } = {},
): Promise<RawBusiness[]> {
  const queries = nicheToQueries(req.niche).slice(0, opts.widen ? 4 : 3);
  const place = req.locationMode === "address" ? req.address : req.city;
  const collected = new Map<string, RawBusiness>();
  const signal = AbortSignal.timeout(35000);
  let requests = 0;
  const budget = opts.widen ? 9 : 6;
  for (const q of queries) {
    let pageToken: string | undefined;
    for (let page = 0; page < 3 && requests < budget; page++) {
      const body: Record<string, unknown> = {
        textQuery:
          req.locationMode === "near_me" || !place ? q : `${q} ${place}`,
        pageSize: 20,
        languageCode: "uk",
        regionCode: "UA",
        ...(pageToken ? { pageToken } : {}),
      };
      if (req.lat != null && req.lng != null)
        body.locationBias = {
          circle: {
            center: { latitude: req.lat, longitude: req.lng },
            radius: Math.min(50000, req.radiusKm * 1000),
          },
        };
      let res: Response;
      try {
        res = await fetch(
          "https://places.googleapis.com/v1/places:searchText",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Goog-Api-Key": apiKey,
              "X-Goog-FieldMask": FIELD_MASK,
            },
            body: JSON.stringify(body),
            cache: "no-store",
            signal,
          },
        );
      } catch {
        throw new ApiError(
          "Google Places не відповів вчасно. Спробуйте ще раз.",
          504,
        );
      }
      requests++;
      if (!res.ok) {
        await res.body?.cancel();
        throw new ApiError(
          res.status === 429
            ? "Вичерпано квоту Google Places. Перевірте ліміти й білінг."
            : res.status === 401 || res.status === 403
              ? "Google Places відхилив ключ. Перевірте Places API (New), обмеження ключа та білінг."
              : `Помилка Google Places (${res.status}). Спробуйте пізніше.`,
          502,
        );
      }
      const data = (await res.json()) as {
        places?: PlaceV1[];
        nextPageToken?: string;
      };
      for (const p of data.places ?? []) {
        // Permanently closed places are never leads.
        if (p.businessStatus === "CLOSED_PERMANENTLY") continue;
        const b = normalizePlaceV1(p, req.niche);
        collected.set(b.sourcePlaceId ?? `${b.name}|${b.address}`, b);
      }
      pageToken = data.nextPageToken;
      if (!pageToken) break;
    }
    if (collected.size >= Math.min(200, req.limit * 2) || requests >= budget)
      break;
  }
  return [...collected.values()];
}

// Resolve a free-text address to coordinates with ONE Places request
// (field mask = location only). Used only when the address is not a known
// city/district, so the radius filter and distances can be applied.
export async function geocodeWithPlaces(
  text: string,
  apiKey: string,
): Promise<{ lat: number; lng: number; label?: string } | null> {
  try {
    const res = await fetch(
      "https://places.googleapis.com/v1/places:searchText",
      {
        method: "POST",
        cache: "no-store",
        signal: AbortSignal.timeout(8000),
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": apiKey,
          "X-Goog-FieldMask": "places.location,places.formattedAddress",
        },
        body: JSON.stringify({
          textQuery: text,
          pageSize: 1,
          languageCode: "uk",
          regionCode: "UA",
        }),
      },
    );
    if (!res.ok) {
      await res.body?.cancel();
      return null;
    }
    const data = (await res.json()) as {
      places?: { location?: { latitude?: number; longitude?: number }; formattedAddress?: string }[];
    };
    const loc = data.places?.[0]?.location;
    if (loc?.latitude == null || loc.longitude == null) return null;
    return {
      lat: loc.latitude,
      lng: loc.longitude,
      label: data.places?.[0]?.formattedAddress,
    };
  } catch {
    return null;
  }
}
