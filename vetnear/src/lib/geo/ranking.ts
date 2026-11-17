// Pet-aware discovery & ranking (Module 2).
import { getOpenNowStatus, withDistances, filterPlacesByRadius } from "@/lib/distance";
import { isSearchablePublicPlace } from "@/lib/data/provenance";
import { isPhoneConfirmedEmergency, isPublicEmergencyVisible } from "@/lib/data/verification";
import { promotionBoost } from "@/lib/places/tier";
import { localityKey, localityOf, regionOf } from "@/config/coverage";
import type {
  Coordinates,
  FilterState,
  PetProfile,
  Place,
  PlaceWithDistance,
  RadiusMeters,
} from "@/lib/types";

export const RADII: RadiusMeters[] = [1000, 2000, 3000, 5000, 10000, 25000, 50000, 100000];

/** Auto-expand ladder used when a radius yields nothing. */
const EXPAND_LADDER = RADII;

export interface RankContext {
  pet?: PetProfile | null;
  filters: FilterState;
  now?: Date;
}

/**
 * Rank places for the active pet. Lower score = shown first.
 * Order of signals follows the spec: distance → pet match → category match →
 * open now → emergency (when requested) → verified → recently updated.
 */
export function rankPlacesForPet(
  places: PlaceWithDistance[],
  ctx: RankContext,
): PlaceWithDistance[] {
  const now = ctx.now ?? new Date();
  const { pet, filters } = ctx;
  const emergencyOnly = filters.emergency || filters.category === "emergency_vet";

  const scored = places.map((p) => {
    let score = 0;

    // 1. distance (primary, normalized to ~0..100)
    score += p.distanceMeters != null ? p.distanceMeters / 1000 : 50;

    // 2. matches active pet animal type
    if (pet && !p.animalTypes.includes(pet.animalType)) score += 8;

    // 3. selected category match
    if (filters.category !== "all" && p.category !== filters.category) score += 6;

    // 4. open now
    if (!getOpenNowStatus(p, now)) score += 4;

    // 5. emergency availability (only weighted when emergency requested)
    if (emergencyOnly && !isPhoneConfirmedEmergency(p, now)) score += 20;

    // 6. verified / claimed
    if (!p.verified) score += 1.5;
    if (!p.claimed) score += 0.5;

    // 7. recently updated
    const ageDays =
      (now.getTime() - new Date(p.updatedAt).getTime()) / 86_400_000;
    score += Math.min(ageDays / 90, 2);

    // 8. paid promotion (v1.9) — a bounded tie-breaker, never an override.
    //    Disabled entirely in emergency mode: money must not reorder urgent care.
    score -= promotionBoost(p, { emergency: emergencyOnly || Boolean(filters.urgentIntent), now });

    return { p, score };
  });

  // Optional explicit sort overrides
  const cmp: Record<string, (a: typeof scored[number], b: typeof scored[number]) => number> = {
    rating: (a, b) => b.p.rating - a.p.rating,
    open_now: (a, b) =>
      Number(getOpenNowStatus(b.p, now)) - Number(getOpenNowStatus(a.p, now)),
    emergency: (a, b) =>
      Number(isPhoneConfirmedEmergency(b.p, now)) -
      Number(isPhoneConfirmedEmergency(a.p, now)),
    verified: (a, b) => Number(b.p.verified) - Number(a.p.verified),
    recent: (a, b) =>
      new Date(b.p.updatedAt).getTime() - new Date(a.p.updatedAt).getTime(),
  };

  scored.sort((a, b) => {
    const override = cmp[filters.sort];
    if (override) {
      const r = override(a, b);
      if (r !== 0) return r;
    }
    return a.score - b.score;
  });

  return scored.map((s) => s.p);
}

export interface DiscoveryResult {
  places: PlaceWithDistance[];
  appliedRadius: RadiusMeters;
  expandedFrom: RadiusMeters | null;
}

/**
 * Full discovery pipeline: filter → radius (with auto-expand) → rank.
 * Auto-expands the radius when the requested one yields no results.
 */
export function getRecommendedPlaces(
  allPlaces: Place[],
  origin: Coordinates | null,
  ctx: RankContext,
): DiscoveryResult {
  const now = ctx.now ?? new Date();
  const { filters, pet } = ctx;
  const emergencyOnly = filters.emergency || filters.category === "emergency_vet";

  // Only approved places with valid coordinates are publicly discoverable.
  // (Coordinate safety P0.6: no-coordinate / needs-geocoding places are excluded
  // from distance-based ranking and the map.)
  const base = allPlaces.filter((p) => isSearchablePublicPlace(p));

  // Non-spatial filters
  const filtered = base.filter((p) => {
    if (filters.region && filters.region !== "all" && regionOf(p) !== filters.region) return false;
    if (filters.locality && localityKey(localityOf(p)) !== localityKey(filters.locality)) return false;
    if (filters.category !== "all" && p.category !== filters.category) return false;
    if (filters.district !== "all" && (regionOf(p) !== "kyiv_city" || p.district !== filters.district)) return false;
    if (filters.animal !== "all" && !p.animalTypes.includes(filters.animal))
      return false;
    if (filters.openNow && !getOpenNowStatus(p, now)) return false;
    // A 24-hour store/pharmacy is not an emergency veterinary provider.
    if (emergencyOnly && (p.emergencyAvailable !== true ||
      (p.category !== "veterinary_clinic" && p.category !== "emergency_vet"))) return false;
    // Hide demo/unverified emergency listings from public emergency-first results.
    if (emergencyOnly && !isPublicEmergencyVisible(p, now)) return false;
    if (filters.verified && !p.verified) return false;
    return true;
  });

  const withDist = withDistances(filtered, origin);

  // Radius with auto-expand
  let appliedRadius = filters.radius;
  let expandedFrom: RadiusMeters | null = null;
  let inRadius = filterPlacesByRadius(withDist, appliedRadius, origin);

  if (origin && inRadius.length === 0) {
    const startIdx = EXPAND_LADDER.indexOf(filters.radius);
    for (let i = startIdx + 1; i < EXPAND_LADDER.length; i++) {
      const r = EXPAND_LADDER[i];
      const next = filterPlacesByRadius(withDist, r, origin);
      if (next.length > 0) {
        inRadius = next;
        expandedFrom = filters.radius;
        appliedRadius = r;
        break;
      }
    }
  }

  const ranked = rankPlacesForPet(inRadius, { pet, filters, now });
  return { places: ranked, appliedRadius, expandedFrom };
}

/** Default discovery filter state. */
export const DEFAULT_FILTERS: FilterState = {
  region: "all",
  locality: "",
  category: "all",
  animal: "all",
  radius: 3000,
  district: "all",
  openNow: false,
  emergency: false,
  verified: false,
  sort: "distance",
};
