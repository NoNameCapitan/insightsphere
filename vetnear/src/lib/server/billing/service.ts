// Prepaid billing service (v1.32): the two operations everything else calls.
// Both run as single database functions (supabase/migrations/007), so a
// payment, the tier change and its history are written together or not at all.
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { VERTICAL } from "@/config/verticals/pet-care-kyiv";
import type { BillingPlan, BillingProviderId } from "@/lib/billing/plans";

export interface ActivatePlanInput {
  placeId: string;
  plan: BillingPlan;
  amountUah: number;
  provider: BillingProviderId;
  /** Provider payment id or bank reference. With it, activation is idempotent. */
  providerPaymentId: string | null;
  actorId: string | null;
  note: string | null;
}

export type ActivatePlanResult =
  | { ok: true; duplicate: boolean; paymentId: string; placeId: string; tier: string; periodEnd: string }
  | { ok: false; error: string };

export async function activatePlan(db: SupabaseClient, input: ActivatePlanInput): Promise<ActivatePlanResult> {
  const { data, error } = await db.rpc("billing_activate_plan", {
    p_place_id: input.placeId,
    p_plan_code: input.plan.code,
    p_tier: input.plan.tier,
    p_months: input.plan.months,
    p_amount_uah: input.amountUah,
    p_provider: input.provider,
    p_provider_payment_id: input.providerPaymentId,
    p_actor_id: input.actorId,
    p_note: input.note,
    p_max_promotion_days: VERTICAL.monetization.maxPromotionDays,
  });
  if (error) {
    console.error("[billing] activate failed:", error.message);
    return { ok: false, error: "storage_error" };
  }
  const result = (data ?? {}) as Record<string, unknown>;
  if (result.ok !== true) return { ok: false, error: typeof result.error === "string" ? result.error : "storage_error" };
  return {
    ok: true,
    duplicate: result.duplicate === true,
    paymentId: String(result.paymentId ?? ""),
    placeId: String(result.placeId ?? input.placeId),
    tier: String(result.tier ?? input.plan.tier),
    periodEnd: String(result.periodEnd ?? ""),
  };
}

/** Returns lapsed places to the free tier and logs each change. */
export async function deactivateExpiredPlans(db: SupabaseClient): Promise<{ ok: true; expired: number } | { ok: false; error: string }> {
  const { data, error } = await db.rpc("billing_expire_plans");
  if (error) {
    console.error("[billing] expire failed:", error.message);
    return { ok: false, error: "storage_error" };
  }
  return { ok: true, expired: Number((data as { expired?: unknown } | null)?.expired ?? 0) };
}
