// Deterministic Kyiv district -> coordinates map (no paid Geocoding API).
// Used to turn "Позняки", "Оболонь", … into a locationBias center and to
// compute distanceKm. Unknown addresses fall back to text search with a note.

import { findCity } from "./cities";

export type GeoPoint = { lat: number; lng: number };

export const KYIV_CENTER: GeoPoint = { lat: 50.4501, lng: 30.5234 };

// Display name -> { point, stems[] }. Stems are lowercased substrings that
// tolerate Ukrainian/Russian declensions (e.g. "позняк" matches "Позняках").
type DistrictEntry = { name: string; point: GeoPoint; stems: string[] };

export const KYIV_DISTRICTS: DistrictEntry[] = [
  { name: "Позняки", point: { lat: 50.396, lng: 30.631 }, stems: ["позняк"] },
  { name: "Осокорки", point: { lat: 50.392, lng: 30.616 }, stems: ["осокорк"] },
  { name: "Оболонь", point: { lat: 50.512, lng: 30.498 }, stems: ["оболон"] },
  {
    name: "Поділ",
    point: { lat: 50.466, lng: 30.516 },
    stems: ["поділ", "подол"],
  },
  {
    name: "Печерськ",
    point: { lat: 50.425, lng: 30.538 },
    stems: ["печерськ", "печерск"],
  },
  {
    name: "Троєщина",
    point: { lat: 50.512, lng: 30.602 },
    stems: ["троєщин", "троещин"],
  },
  {
    name: "Голосіїв",
    point: { lat: 50.38, lng: 30.512 },
    stems: ["голосіїв", "голосеев"],
  },
  {
    name: "Святошино",
    point: { lat: 50.458, lng: 30.366 },
    stems: ["святошин"],
  },
  { name: "Дарниця", point: { lat: 50.447, lng: 30.622 }, stems: ["дарниц"] },
  {
    name: "Виноградар",
    point: { lat: 50.488, lng: 30.412 },
    stems: ["виноградар"],
  },
  {
    name: "Солом'янка",
    point: { lat: 50.43, lng: 30.49 },
    stems: ["солом'янк", "соломянк", "соломьянк"],
  },
  { name: "Нивки", point: { lat: 50.46, lng: 30.42 }, stems: ["нивк"] },
  { name: "Теремки", point: { lat: 50.365, lng: 30.455 }, stems: ["теремк"] },
  { name: "Центр", point: { lat: 50.447, lng: 30.522 }, stems: ["центр"] },
];

// Find a known district anywhere in the given free text.
export function findKyivDistrict(
  text: string | undefined,
): DistrictEntry | null {
  if (!text) return null;
  const t = text.toLowerCase();
  for (const d of KYIV_DISTRICTS) {
    if (
      d.name === "Центр" &&
      !/^(центр|центрі|центре)(,?\s+(київ|киев|kyiv|kiev))?$/.test(t.trim())
    )
      continue;
    if (d.stems.some((s) => t.includes(s))) return d;
  }
  return null;
}

export type GeoResolution = {
  center: GeoPoint | null; // null => no usable coordinates (text search only)
  source: "near_me" | "district" | "city" | "geocoded" | "none";
  districtName?: string;
  cityName?: string;
  approximate: boolean; // true => radius could not be applied
  // Effective radius used for locationBias and the distance filter.
  radiusKm: number;
  wholeCity?: boolean;
  note?: string;
};

export const DEFAULT_RADIUS_KM = 5;

// Resolve a search intent to a coordinate center for locationBias + distance.
// Looks at explicit coords (near me), then a Kyiv district, then any built-in
// Ukrainian city. radiusKm = 0 in city mode means "the whole city".
export function resolveSearchGeo(input: {
  locationMode: "near_me" | "city" | "address";
  lat?: number;
  lng?: number;
  city?: string;
  address?: string;
  query?: string;
  radiusKm?: number;
}): GeoResolution {
  const explicitRadius =
    input.radiusKm && input.radiusKm > 0 ? input.radiusKm : undefined;
  if (
    input.locationMode === "near_me" &&
    input.lat != null &&
    input.lng != null
  ) {
    return {
      center: { lat: input.lat, lng: input.lng },
      source: "near_me",
      approximate: false,
      radiusKm: explicitRadius ?? DEFAULT_RADIUS_KM,
    };
  }

  const cityText = (input.city ?? "").trim();
  const city = cityText ? findCity(cityText) : findCity("Київ");
  const isKyiv = city?.name === "Київ";
  const district =
    isKyiv && input.locationMode === "address"
      ? findKyivDistrict(input.address)
      : null;
  if (district) {
    return {
      center: district.point,
      source: "district",
      districtName: district.name,
      cityName: "Київ",
      approximate: false,
      radiusKm: explicitRadius ?? DEFAULT_RADIUS_KM,
    };
  }

  if (input.locationMode === "address" && input.address) {
    // Unknown specific address: the search route may geocode it via Places.
    return {
      center: null,
      source: "none",
      approximate: true,
      radiusKm: explicitRadius ?? DEFAULT_RADIUS_KM,
      note: "Пошук за текстом адреси. Точний радіус для цієї адреси не застосовано.",
    };
  }

  if (city && (!cityText || findCity(cityText))) {
    return {
      center: city.point,
      source: "city",
      cityName: city.name,
      approximate: false,
      radiusKm: explicitRadius ?? city.radiusKm,
      wholeCity: !explicitRadius,
    };
  }

  // A city we don't have coordinates for.
  return {
    center: null,
    source: "none",
    approximate: true,
    radiusKm: explicitRadius ?? DEFAULT_RADIUS_KM,
    note: "Пошук за назвою міста. Точний радіус для цього міста не застосовано.",
  };
}
