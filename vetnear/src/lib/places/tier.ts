// Commercial tier rules (v1.9). Pure, server- and client-safe.
//
// Design rule that must not be relaxed: paid promotion is a *tie-breaker*, not
// a ranking override, it is always visible to the user, and it is switched off
// entirely in emergency mode. VetNear's product claim is data honesty; a paid
// slot that quietly outranks a closer clinic would destroy it.
import { VERTICAL } from "@/config/verticals/pet-care-kyiv";
import type { Place, PlaceTier } from "@/lib/types";

/** Score bonus (subtracted from the score, lower = shown first). */
export const PROMOTED_BOOST = 1.2;

/** Hard ceiling: promotion can never move a place ahead of one this much closer. */
export const PROMOTED_MAX_DISTANCE_ADVANTAGE_M = 1200;

export const TIER_LABELS: Record<PlaceTier, string> = {
  free: "Безкоштовний профіль",
  verified: "Підтверджений партнер",
  promoted: "Промо-розміщення",
};

export function tierOf(place: Pick<Place, "tier">): PlaceTier {
  return place.tier ?? "free";
}

/**
 * A promotion counts only while it is paid for. An expired or missing
 * `promotedUntil` silently degrades the place to its organic position.
 */
export function isPromotionActive(
  place: Pick<Place, "tier" | "promotedUntil">,
  now: Date = new Date(),
): boolean {
  if (tierOf(place) !== "promoted") return false;
  if (!place.promotedUntil) return false;
  const until = Date.parse(place.promotedUntil);
  if (!Number.isFinite(until)) return false;
  return until > now.getTime();
}

export interface PromotionContext {
  /** True when the user is in an urgent/emergency flow. */
  emergency: boolean;
  now?: Date;
}

/**
 * The boost applied during ranking. Returns 0 whenever promotion must not
 * apply: emergency mode, expired promotion, or a non-promoted tier.
 */
export function promotionBoost(
  place: Pick<Place, "tier" | "promotedUntil">,
  ctx: PromotionContext,
): number {
  const policy = VERTICAL.monetization;
  if (!policy.promotionEnabled) return 0;
  if (ctx.emergency && policy.promotionDisabledWhenUrgent) return 0;
  if (!isPromotionActive(place, ctx.now ?? new Date())) return 0;
  return PROMOTED_BOOST;
}

/** Whether the UI must render the "Промо" label for this place. */
export function shouldLabelAsPromoted(
  place: Pick<Place, "tier" | "promotedUntil">,
  ctx: PromotionContext,
): boolean {
  return promotionBoost(place, ctx) > 0;
}
