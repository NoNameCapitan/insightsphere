// Prepaid plans for places (v1.32). Pure data + validation, shared by the
// admin API, the webhook, the admin UI and the tests.
//
// A plan = a paid tier for a number of months. `listPriceUah` is the public
// price where one exists; Promoted is priced by agreement, so the amount is
// always entered explicitly when a payment is recorded.
import type { PlaceTier } from "@/lib/types";

export type PaidTier = Exclude<PlaceTier, "free">;

export interface BillingPlan {
  code: string;
  tier: PaidTier;
  months: number;
  label: string;
  /** null = priced by agreement. */
  listPriceUah: number | null;
}

export const VERIFIED_MONTHLY_UAH = 449;

export const BILLING_PLANS: readonly BillingPlan[] = [
  { code: "verified_1m", tier: "verified", months: 1, label: "Verified · 1 місяць", listPriceUah: VERIFIED_MONTHLY_UAH },
  { code: "verified_3m", tier: "verified", months: 3, label: "Verified · 3 місяці", listPriceUah: VERIFIED_MONTHLY_UAH * 3 },
  { code: "verified_6m", tier: "verified", months: 6, label: "Verified · 6 місяців", listPriceUah: VERIFIED_MONTHLY_UAH * 6 },
  { code: "verified_12m", tier: "verified", months: 12, label: "Verified · 12 місяців", listPriceUah: VERIFIED_MONTHLY_UAH * 12 },
  { code: "promoted_1m", tier: "promoted", months: 1, label: "Promoted · 1 місяць", listPriceUah: null },
  { code: "promoted_3m", tier: "promoted", months: 3, label: "Promoted · 3 місяці", listPriceUah: null },
];

export function getBillingPlan(code: unknown): BillingPlan | null {
  return typeof code === "string" ? (BILLING_PLANS.find((plan) => plan.code === code) ?? null) : null;
}

export type BillingProviderId = "manual" | "liqpay" | "fondy" | "stripe";

export interface ActivationRequest {
  placeId: string;
  plan: BillingPlan;
  amountUah: number;
  /** Bank reference / invoice number; makes a repeated click harmless. */
  paymentRef: string | null;
  note: string | null;
}

export type ActivationValidation = { ok: true; value: ActivationRequest } | { ok: false; error: string };

/** Validates what an admin submits when marking a prepayment as received. */
export function validateActivation(raw: unknown): ActivationValidation {
  const input = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const placeId = typeof input.placeId === "string" ? input.placeId.trim().slice(0, 120) : "";
  if (!placeId) return { ok: false, error: "placeId is required" };
  const plan = getBillingPlan(input.planCode);
  if (!plan) return { ok: false, error: "unknown planCode" };
  const amount = typeof input.amountUah === "number" ? input.amountUah : typeof input.amountUah === "string" && input.amountUah.trim() !== "" ? Number(input.amountUah.replace(",", ".")) : NaN;
  // An explicit amount is required: a paid tier is never switched on "for free" by omission.
  if (!Number.isFinite(amount) || amount < 0 || amount >= 1_000_000) return { ok: false, error: "amountUah is required" };
  const text = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) || null : null);
  return { ok: true, value: { placeId, plan, amountUah: Math.round(amount * 100) / 100, paymentRef: text(input.paymentRef, 120), note: text(input.note, 500) } };
}

export const ACTIVATION_ERROR_TEXT: Record<string, string> = {
  place_not_found: "Заклад із таким ідентифікатором не опубліковано.",
  promotion_too_long: "Promoted не може тривати довше дозволеного максимуму.",
  invalid_tier: "Невідомий тариф.",
  invalid_period: "Невірний період.",
  invalid_amount: "Вкажіть суму оплати.",
};
