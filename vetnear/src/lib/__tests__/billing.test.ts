import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { planTierChange, sanitizePartnerInterest } from "@/lib/places/billing";

const read = (file: string) => readFileSync(join(process.cwd(), file), "utf8");
const NOW = new Date("2026-11-12T10:00:00.000Z");

describe("billing foundation", () => {
  it("plans manual tier changes with honest defaults", () => {
    expect(planTierChange({ tier: "free" }, 90, NOW)).toEqual({
      ok: true,
      change: { tier: "free", promotedUntil: null, subscriptionStatus: "none", billingProvider: null, note: null },
    });
    expect(planTierChange({ tier: "verified", note: "  оплата за рахунком №7  " }, 90, NOW)).toEqual({
      ok: true,
      change: { tier: "verified", promotedUntil: null, subscriptionStatus: "active", billingProvider: "manual", note: "оплата за рахунком №7" },
    });
    const promo = planTierChange({ tier: "promoted", promotedDays: 30 }, 90, NOW);
    expect(promo.ok && promo.change.promotedUntil).toBe("2026-12-12T10:00:00.000Z");
  });

  it("never allows an open-ended or over-long promotion", () => {
    expect(planTierChange({ tier: "promoted" }, 90, NOW).ok).toBe(false);
    expect(planTierChange({ tier: "promoted", promotedDays: 0 }, 90, NOW).ok).toBe(false);
    expect(planTierChange({ tier: "promoted", promotedDays: 91 }, 90, NOW).ok).toBe(false);
    expect(planTierChange({ tier: "promoted", promotedDays: 1.5 }, 90, NOW).ok).toBe(false);
  });

  it("rejects unknown tiers and inconsistent subscription states", () => {
    expect(planTierChange({ tier: "gold" }, 90, NOW).ok).toBe(false);
    expect(planTierChange({ tier: "verified", subscriptionStatus: "none" }, 90, NOW).ok).toBe(false);
    expect(planTierChange({ tier: "verified", subscriptionStatus: "paid" }, 90, NOW).ok).toBe(false);
    const free = planTierChange({ tier: "free", subscriptionStatus: "active" }, 90, NOW);
    expect(free.ok && free.change.subscriptionStatus).toBe("none");
    const pastDue = planTierChange({ tier: "verified", subscriptionStatus: "past_due" }, 90, NOW);
    expect(pastDue.ok && pastDue.change.subscriptionStatus).toBe("past_due");
  });

  it("validates the paid-tier request form", () => {
    const ok = sanitizePartnerInterest({ placeName: " Animalia ", phone: "+380 44 123 45 67", email: "Owner@Clinic.UA", plan: "verified", tier: "promoted" });
    expect(ok).toEqual({ ok: true, value: { placeName: "Animalia", phone: "+380 44 123 45 67", email: "owner@clinic.ua", plan: "verified", note: null } });
    const bad = sanitizePartnerInterest({ placeName: "A", phone: "abc", email: "nope", plan: "gold" });
    expect(bad).toEqual({ ok: false, errors: ["placeName", "phone", "email", "plan"] });
  });

  it("migration 006 keeps billing tables server-only and the tier history append-only", () => {
    const sql = read("supabase/migrations/006_billing_foundation.sql");
    for (const column of ["subscription_status", "billing_provider", "billing_customer_id", "billing_subscription_id", "tier_changed_at"]) {
      expect(sql, column).toContain(column);
    }
    expect(sql).toContain("before update or delete on place_tier_events");
    expect(sql).toContain("alter table place_tier_events enable row level security");
    expect(sql).toContain("alter table partner_interest  enable row level security");
    expect(sql).toContain("revoke all on table place_tier_events, partner_interest from public, anon, authenticated");
    expect(sql).not.toMatch(/create policy/i);
  });

  it("says plainly on the partner page that online payment is not connected yet", () => {
    const page = read("src/app/for-partners/page.tsx");
    expect(page).toContain("рахунок виставляємо вручну");
    expect(page).toContain("Жоден тариф не дає позначку 24/7");
  });
});
