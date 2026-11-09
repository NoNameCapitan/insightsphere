// ───────────────────────────────────────────────────────────────────────────
// directory-core — vertical configuration (v1.9).
//
// Everything that makes this codebase "pet care in Kyiv" rather than "a local
// directory" is declared here. The discovery pipeline, ranking, moderation,
// publishing, lead tracking and SEO layer underneath are vertical-agnostic.
//
// Reusing the platform for another vertical means writing one config file and
// swapping the seed dataset — not editing components.
//
// The type is generic over the category id union, so a new vertical brings its
// own categories and still gets compile-time completeness checks.
// ───────────────────────────────────────────────────────────────────────────

export interface CategoryDefinition<TCategory extends string = string> {
  id: TCategory;
  /** Display label in the product locale. */
  label: string;
  emoji: string;
  /** Map marker colour (hex). */
  color: string;
  /** SEO landing slug, e.g. "vet-clinic-near-me". Omit for no landing page. */
  seoSlug?: string;
  /** schema.org @type used in JSON-LD for this category. */
  schemaType: string;
  /**
   * Participates in the urgent flow. Urgent categories are subject to the
   * phone-confirmation rule below and are exempt from paid promotion.
   */
  urgent?: boolean;
}

export interface CityDefinition<TDistrict extends string = string> {
  id: string;
  /** Nominative city name, e.g. "Київ". */
  name: string;
  /** Locative form used in copy, e.g. "у Києві". */
  locative: string;
  center: { latitude: number; longitude: number };
  /** Sanity box for published coordinates — rejects mistyped values. */
  bounds: { minLat: number; maxLat: number; minLng: number; maxLng: number };
  districts: Record<TDistrict, string>;
}

export interface UrgencyPolicy {
  /** Whether the vertical has an urgent/emergency concept at all. */
  enabled: boolean;
  /**
   * Urgent availability (24/7, emergency intake) may only be published after a
   * recorded human confirmation. This is the invariant enforced in
   * lib/places/publish.ts — a directory that guesses about urgent care is
   * actively dangerous.
   */
  requiresHumanConfirmation: boolean;
  /**
   * The urgency level is decided by deterministic rules; an LLM may only
   * explain the result, never set or override it.
   */
  deterministicTriage: boolean;
  /** Copy shown wherever the product must state it does not diagnose. */
  nonDiagnosticNotice: string;
}

export interface MonetizationPolicy {
  /** Paid promotion available at all. */
  promotionEnabled: boolean;
  /** Promotion is switched off in urgent results. Keep true for safety verticals. */
  promotionDisabledWhenUrgent: boolean;
  /** Maximum promotion term an admin may grant, in days. */
  maxPromotionDays: number;
}

export interface VerticalConfig<
  TCategory extends string = string,
  TDistrict extends string = string,
> {
  id: string;
  productName: string;
  /** One-line positioning used in metadata and hero copy. */
  tagline: string;
  /**
   * What the directory is about, for generated copy:
   * "заклад для тварин", "клініка для пацієнтів", ...
   */
  subject: { singular: string; plural: string };
  city: CityDefinition<TDistrict>;
  categories: CategoryDefinition<TCategory>[];
  urgency: UrgencyPolicy;
  monetization: MonetizationPolicy;
}

/** Build a `Record<TCategory, V>` from the config's category list. */
export function categoryMap<TCategory extends string, V>(
  config: VerticalConfig<TCategory, string>,
  pick: (c: CategoryDefinition<TCategory>) => V,
): Record<TCategory, V> {
  const out = {} as Record<TCategory, V>;
  for (const c of config.categories) out[c.id] = pick(c);
  return out;
}

/** Category ids flagged urgent for this vertical. */
export function urgentCategories<TCategory extends string>(
  config: VerticalConfig<TCategory, string>,
): TCategory[] {
  return config.categories.filter((c) => c.urgent).map((c) => c.id);
}

/** Whether a coordinate pair falls inside the vertical's city bounds. */
export function isWithinCityBounds(
  config: VerticalConfig<string, string>,
  latitude: number,
  longitude: number,
): boolean {
  const b = config.city.bounds;
  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude > b.minLat &&
    latitude < b.maxLat &&
    longitude > b.minLng &&
    longitude < b.maxLng
  );
}
