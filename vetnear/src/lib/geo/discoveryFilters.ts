import { DEFAULT_FILTERS, RADII } from "@/lib/geo/ranking";
import { normalizeRegion } from "@/config/coverage";
import { ALL_ANIMALS, ALL_CATEGORIES, normalizeDistrict } from "@/lib/labels";
import type { AnimalType, FilterState, PlaceCategory, RadiusMeters } from "@/lib/types";

export function filtersFromSearchParams(params: URLSearchParams): FilterState {
  const f = { ...DEFAULT_FILTERS };
  const region = normalizeRegion(params.get("region"));
  if (region) f.region = region;
  const locality = params.get("locality")?.trim().slice(0, 100);
  if (locality) f.locality = locality;
  // accept both ?category= and legacy ?type=
  const category = (params.get("category") || params.get("type")) as
    | PlaceCategory
    | null;
  if (category && ALL_CATEGORIES.includes(category)) f.category = category;
  const animal = params.get("animal") as AnimalType | null;
  if (animal && ALL_ANIMALS.includes(animal)) f.animal = animal;
  // Old links may still carry pre-v1.25 neighbourhood slugs.
  const district = normalizeDistrict(params.get("district"));
  if (district && f.region !== "kyiv_oblast") { f.district = district; f.region = "kyiv_city"; f.locality = ""; }
  const radius = Number(params.get("radius")) as RadiusMeters;
  if (RADII.includes(radius)) f.radius = radius;
  if (params.get("emergency") === "1") f.emergency = true;
  if (params.get("urgent") === "1") f.urgentIntent = true;
  const sort = params.get("sort");
  if (sort && ["distance", "pet_match", "open_now", "emergency", "verified", "recent", "rating"].includes(sort)) f.sort = sort as FilterState["sort"];
  return f;
}

