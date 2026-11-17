import type { PartnerPlan, PlaceTier } from "@/lib/types";
import { isPartnerPlan } from "@/lib/partners/plans";

/** Only the server may construct this state from verified provider evidence.
 * Public intake payloads never accept these fields. This is not payment proof
 * by itself and must never be hydrated from localStorage or query parameters. */
export interface BillingSubscription {
  plan: PartnerPlan;
  status: "pending" | "active" | "past_due" | "cancelled";
  paymentStatus: "unpaid" | "paid" | "refunded";
  approvedPriceId: string | null;
  providerSubscriptionId: string | null;
  verifiedEventId: string | null;
  paidAt: string | null;
  periodStart: string | null;
  periodEnd: string | null;
}

export interface PartnerEntitlements {
  listing: true;
  enhancedProfile: boolean;
  analytics: boolean;
  multiLocation: boolean;
  promotion: boolean;
  tier: PlaceTier;
  verificationBadge: false;
  emergencyBadge: false;
}

/** Buying a plan never proves medical capability or emergency availability. */
export function resolvePartnerEntitlements(
  subscription: BillingSubscription | null,
  context: { billingConnected: boolean; urgent: boolean; now?: Date },
): PartnerEntitlements {
  const base: PartnerEntitlements = { listing: true, enhancedProfile: false, analytics: false, multiLocation: false, promotion: false, tier: "free", verificationBadge: false, emergencyBadge: false };
  const now = (context.now ?? new Date()).getTime();
  if (!context.billingConnected || !subscription || !isPartnerPlan(subscription.plan) || subscription.plan === "free"
    || subscription.status !== "active" || subscription.paymentStatus !== "paid"
    || !subscription.approvedPriceId || !subscription.providerSubscriptionId || !subscription.verifiedEventId) return base;
  const paidAt = Date.parse(subscription.paidAt ?? "");
  const start = Date.parse(subscription.periodStart ?? "");
  const end = Date.parse(subscription.periodEnd ?? "");
  if (![paidAt, start, end, now].every(Number.isFinite) || paidAt > now || start > now || end <= now || end <= start) return base;
  const promotion = !context.urgent && (subscription.plan === "pro" || subscription.plan === "multi_location");
  // Legacy PlaceTier has a misleading "verified" member. Payment must never
  // produce it: non-promoted paid tools leave the public listing tier unchanged.
  return { ...base, enhancedProfile: true, analytics: true, multiLocation: subscription.plan === "multi_location", promotion, tier: promotion ? "promoted" : "free" };
}
