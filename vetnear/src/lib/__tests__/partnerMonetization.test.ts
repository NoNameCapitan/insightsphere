import { describe, expect, it, vi } from "vitest";
import { resolvePartnerEntitlements, type BillingSubscription } from "@/lib/billing/entitlements";
import { parsePartnerInterest } from "@/lib/partners/interest";
import { PARTNER_PLANS } from "@/lib/partners/plans";
import { promotionBoost, shouldLabelAsPromoted } from "@/lib/places/tier";
import { getBillingProvider } from "@/lib/billing/provider";

vi.mock("server-only", () => ({}));
const now = new Date("2026-11-17T12:00:00Z");
const paid: BillingSubscription = { plan: "pro", status: "active", paymentStatus: "paid", approvedPriceId: "approved-price", providerSubscriptionId: "provider-sub", verifiedEventId: "verified-event", paidAt: "2026-11-01T00:00:00Z", periodStart: "2026-11-01T00:00:00Z", periodEnd: "2026-12-01T00:00:00Z" };
const context = { billingConnected: true, urgent: false, now };
const input = { requestId: "00000000-0000-4000-8000-000000000001", organization: "Тестовий заклад", contactName: "", contactEmail: "test@example.org", locality: "Київ", officialWebsite: "https://example.org", requestedPlan: "pro", foundingPartner: true, message: "Тест", consent: true };

describe("paid entitlement boundary", () => {
  it("never activates while the provider is disconnected", () => {
    expect(resolvePartnerEntitlements(paid, { ...context, billingConnected: false }).tier).toBe("free");
  });
  it.each(["pending", "past_due", "cancelled"] as const)("does not activate %s subscriptions", status => {
    expect(resolvePartnerEntitlements({ ...paid, status }, context).enhancedProfile).toBe(false);
  });
  it.each(["unpaid", "refunded"] as const)("does not activate %s subscriptions", paymentStatus => {
    expect(resolvePartnerEntitlements({ ...paid, paymentStatus }, context).promotion).toBe(false);
  });
  it.each(["approvedPriceId", "providerSubscriptionId", "verifiedEventId", "paidAt", "periodStart", "periodEnd"] as const)("requires %s evidence", field => {
    expect(resolvePartnerEntitlements({ ...paid, [field]: null }, context).tier).toBe("free");
  });
  it("expires at the boundary and rejects future payment dates", () => {
    expect(resolvePartnerEntitlements({ ...paid, periodEnd: now.toISOString() }, context).analytics).toBe(false);
    expect(resolvePartnerEntitlements({ ...paid, paidAt: "2027-01-01" }, context).analytics).toBe(false);
  });
  it("has no medical verification entitlement, even after confirmed payment", () => {
    const result = resolvePartnerEntitlements(paid, context);
    expect(result.enhancedProfile).toBe(true);
    expect(result.verificationBadge).toBe(false);
    expect(result.emergencyBadge).toBe(false);
    expect(resolvePartnerEntitlements({ ...paid, plan: "verified" }, context).tier).toBe("free");
  });
  it("never grants promotion during urgent search at either boundary", () => {
    expect(resolvePartnerEntitlements(paid, { ...context, urgent: true }).promotion).toBe(false);
    expect(resolvePartnerEntitlements(paid, { ...context, urgent: true }).tier).toBe("free");
    const place = { tier: "promoted" as const, promotedUntil: paid.periodEnd };
    expect(promotionBoost(place, { emergency: true, now })).toBe(0);
    expect(shouldLabelAsPromoted(place, { emergency: true, now })).toBe(false);
  });
  it("leaves all existing paid price proposals unapproved", () => {
    expect(PARTNER_PLANS.filter(p => p.id !== "free").every(p => !p.priceApproved)).toBe(true);
  });
  it("disabled billing adapter cannot create a checkout or verify an event", async () => {
    const provider = getBillingProvider();
    expect(provider.id).toBe("disabled");
    expect(await provider.createCheckout({ partnerId: "test", plan: "pro", approvedPriceId: "test" })).toEqual({ available: false, reason: "not_connected" });
    expect(await provider.verifyWebhook("{}", "forged")).toEqual({ verified: false });
  });
});

describe("partner interest is not an activation request", () => {
  it("strips injected billing fields and retains only requested plan", () => {
    const result = parsePartnerInterest({ ...input, planActive: true, status: "active", paymentStatus: "paid", tier: "promoted", price: 0 });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.requestedPlan).toBe("pro");
      expect(result.value).not.toHaveProperty("paymentStatus");
      expect(result.value).not.toHaveProperty("tier");
      expect(result.value).not.toHaveProperty("status");
    }
  });
  it.each([{ consent: false }, { requestedPlan: "unlimited" }, { contactEmail: "invalid" }, { officialWebsite: "javascript:alert(1)" }, { requestId: "non-uuid" }])("rejects invalid input %j", change => {
    expect(parsePartnerInterest({ ...input, ...change }).ok).toBe(false);
  });
});
