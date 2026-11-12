// Billing foundation (v1.31). No payment provider is connected yet: an admin
// sets the tier after a manual agreement. The shape below is what a provider
// webhook (LiqPay / Fondy / Stripe) will write later, so nothing here needs to
// change when payments are switched on.
import type { PlaceTier } from "@/lib/types";

export const PLACE_TIERS: PlaceTier[] = ["free", "verified", "promoted"];
export const SUBSCRIPTION_STATUSES = ["none", "active", "past_due", "canceled"] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];
export const BILLING_PROVIDERS = ["manual", "liqpay", "fondy", "stripe"] as const;
export type BillingProvider = (typeof BILLING_PROVIDERS)[number];

export interface TierChangeInput {
  tier?: unknown;
  promotedDays?: unknown;
  subscriptionStatus?: unknown;
  note?: unknown;
}

export interface TierChange {
  tier: PlaceTier;
  promotedUntil: string | null;
  subscriptionStatus: SubscriptionStatus;
  billingProvider: BillingProvider | null;
  note: string | null;
}

export type TierChangeResult = { ok: true; change: TierChange } | { ok: false; error: string };

/**
 * Validates an admin tier change. A `promoted` tier always needs an end date
 * (an open-ended paid boost quietly rots ranking honesty), and a free tier
 * never carries a subscription.
 */
export function planTierChange(input: TierChangeInput, maxPromotionDays: number, now: Date = new Date()): TierChangeResult {
  const tier = input.tier as PlaceTier;
  if (!PLACE_TIERS.includes(tier)) return { ok: false, error: "a valid tier is required" };

  let promotedUntil: string | null = null;
  if (tier === "promoted") {
    const days = Number(input.promotedDays);
    if (!Number.isInteger(days) || days <= 0 || days > maxPromotionDays) {
      return { ok: false, error: `promotedDays must be 1..${maxPromotionDays}` };
    }
    promotedUntil = new Date(now.getTime() + days * 86_400_000).toISOString();
  }

  const requested = input.subscriptionStatus;
  if (requested !== undefined && !SUBSCRIPTION_STATUSES.includes(requested as SubscriptionStatus)) {
    return { ok: false, error: "invalid subscriptionStatus" };
  }
  const subscriptionStatus: SubscriptionStatus =
    tier === "free" ? "none" : ((requested as SubscriptionStatus | undefined) ?? "active");
  if (tier !== "free" && subscriptionStatus === "none") {
    return { ok: false, error: "a paid tier needs a subscription status" };
  }

  const note = typeof input.note === "string" ? input.note.trim().slice(0, 500) || null : null;
  return {
    ok: true,
    change: { tier, promotedUntil, subscriptionStatus, billingProvider: tier === "free" ? null : "manual", note },
  };
}

export const INTEREST_PLANS = ["verified", "promoted", "network"] as const;
export type InterestPlan = (typeof INTEREST_PLANS)[number];

export interface PartnerInterest {
  placeName: string;
  phone: string;
  email: string;
  plan: InterestPlan;
  note: string | null;
}

const PHONE = /^\+?[0-9][0-9\s()-]{6,18}$/;
const EMAIL = /^[^\s@<>()"',;:\\]+@[^\s@<>()"',;:\\]+\.[a-z]{2,24}$/i;

/** Validates the public "I want Verified / Promoted" form. */
export function sanitizePartnerInterest(raw: unknown): { ok: true; value: PartnerInterest } | { ok: false; errors: string[] } {
  const input = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
  const errors: string[] = [];
  const placeName = str(input.placeName, 120);
  const phone = str(input.phone, 20);
  const email = str(input.email, 160).toLowerCase();
  const plan = input.plan as InterestPlan;
  if (placeName.length < 2) errors.push("placeName");
  if (!PHONE.test(phone)) errors.push("phone");
  if (!EMAIL.test(email)) errors.push("email");
  if (!INTEREST_PLANS.includes(plan)) errors.push("plan");
  if (errors.length) return { ok: false, errors };
  return { ok: true, value: { placeName, phone, email, plan, note: str(input.note, 1000) || null } };
}
